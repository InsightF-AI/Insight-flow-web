/**
 * Camada de acesso a dados — ponto único de integração com o backend FastAPI (`/api/v1`,
 * via proxy do Vite). O que a API expõe vem dela; o que ela ainda não expõe (notícias,
 * rankings, score, sessões, perfil) continua em mock em memória, marcado nos métodos.
 */
import { ASSETS, byTicker, generateCandles } from './mock/assets.js';
import { RULES, SIGNALS, BACKTESTS, ruleOf } from './mock/signals.js';
import { DISCLAIMER } from './mock/ai.js';
import { NEWS } from './mock/news.js';
import { computeIndicators, lastDefined } from '../lib/indicators.js';
import { fmtBRL, fmtPct, fmtNum } from '../lib/format.js';
import { useAuthStore, useUiStore } from '../store/index.js';

const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));

/* ---------- integração real com a API (RF-01, RF-02) ---------- */
const API_BASE = '/api/v1';

/** Extrai o `sub` (id do usuário) do payload de um JWT, sem validar assinatura
 * — a validação de verdade é feita pelo backend a cada requisição autenticada. */
function decodeJwtSub(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
  } catch {
    return null;
  }
}

/** O access token dura 30 min: num 401, troca o refresh token por um par novo e repete a
 * chamada uma vez. Renovações concorrentes compartilham a mesma promise (o refresh token é
 * rotacionado pelo backend, então duas trocas paralelas invalidariam uma à outra). */
let renovacaoEmAndamento = null;
export function renovarTokens() {
  if (renovacaoEmAndamento) return renovacaoEmAndamento;
  const { refreshToken, setTokens, signOut } = useAuthStore.getState();
  renovacaoEmAndamento = (async () => {
    if (!refreshToken) throw new Error('Sessão expirada.');
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => null);
    if (!res?.ok) {
      signOut();
      throw new Error('Sessão expirada. Entre novamente.');
    }
    const data = await res.json();
    setTokens({ token: data.access_token, refreshToken: data.refresh_token });
    return data.access_token;
  })().finally(() => {
    renovacaoEmAndamento = null;
  });
  return renovacaoEmAndamento;
}

async function apiFetch(path, options = {}, tentouRenovar = false) {
  const { timeoutMs = 20_000, ...fetchOptions } = options;
  const token = useAuthStore.getState().token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(fetchOptions.headers || {}),
      },
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('O servidor demorou demais para responder. Tente novamente.');
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && token && !tentouRenovar && !path.startsWith('/auth/')) {
    await renovarTokens();
    return apiFetch(path, options, true);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // 422 do FastAPI devolve `detail` como lista de erros de validação, não string.
    const detalhe = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail;
    const err = new Error(detalhe || 'Erro inesperado. Tente novamente.');
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/** RNF-10 — ponto único de latência simulada (300–800 ms) e do alternador "Forçar erro"
 * (Configurações → Modo desenvolvedor). Usado só pelos métodos de leitura (os que alimentam
 * useQuery/skeletons) — mutações mantêm seus próprios delays e ficam fora do toggle, pra não
 * travar ações como login/criação enquanto se testa o estado de erro de uma tela. */
const delayRead = async () => {
  await delay(300 + Math.random() * 500);
  if (useUiStore.getState().forcarErro) {
    throw new Error('Falha ao carregar os dados. Verifique sua conexão e tente novamente.');
  }
};

/* ---------- estado mutável da sessão (substituído pelo banco no backend) ---------- */
// ticker -> {id, notificar, nome, tipo, setor, moeda} do último getWatchlist().
// É também o único jeito que temos de resolver o UUID real de um ativo no backend: a API
// não expõe um endpoint pra buscar/criar um ativo por ticker fora do fluxo de watchlist, então
// cotação/histórico/indicadores só usam dados reais para ativos que já estão na watchlist —
// para os demais (ex: resultado de busca ainda não adicionado), cai no mock mesmo.
let watchlistIndex = new Map();
// alerta_id -> último AlertaResponse visto em getUserRules() (pra saber o estado ao alternar).
let alertasIndex = new Map();
// sinal_id -> notificação SINAL_ATIVADO correspondente (pra marcar como lida no backend).
let notificacoesSinal = new Map();

/** Notificação do backend (REST ou WebSocket) no formato de "disparo" que a UI já usa. */
export function mapNotificacao(n) {
  const ticker = [...watchlistIndex.entries()].find(([, v]) => v.id === n.ativo_id)?.[0] ?? '';
  return {
    id: n.id,
    ticker,
    tipo: n.tipo,
    texto: n.mensagem,
    canais: ['PUSH'],
    entrega: { PUSH: 'entregue' },
    data: n.criado_em,
    visto: n.lida,
  };
}

/** Garante que watchlistIndex está populado antes de checar um ticker — quem entra direto numa
 * página de ativo (sem passar pelo Dashboard antes) pode chegar aqui com o índice ainda vazio,
 * já que ele só é preenchido como efeito colateral de getWatchlist(). */
async function resolverAtivoCache(ticker) {
  if (watchlistIndex.has(ticker)) return watchlistIndex.get(ticker);
  try {
    await carregarWatchlistIndex();
  } catch {
    return undefined;
  }
  return watchlistIndex.get(ticker);
}

/** GET /watchlist só pra (re)popular o índice ticker -> ativo, sem buscar cotações. */
async function carregarWatchlistIndex() {
  const items = await apiFetch('/watchlist');
  watchlistIndex = new Map(
    items.map((it) => [
      it.ativo.ticker,
      { id: it.ativo.id, notificar: it.notificar, nome: it.ativo.nome, tipo: it.ativo.tipo, setor: it.ativo.setor, moeda: it.ativo.moeda },
    ]),
  );
  return items;
}

/** Sinais reais de um ativo (GET /ativos/{id}/sinais), cada um com seu backtest. */
async function sinaisReais(ticker, ativoId, apenasAtivos) {
  const sinais = await apiFetch(`/ativos/${ativoId}/sinais`);
  const filtrados = sinais.filter((s) => !apenasAtivos || !s.data_desativacao);
  return Promise.all(
    filtrados.map(async (s) => {
      const bt = await apiFetch(`/ativos/${ativoId}/sinais/${s.regra_id}/backtest`).catch(() => null);
      return {
        id: s.id,
        ticker,
        regra_id: s.regra_id,
        data_ativacao: s.data_ativacao,
        data_desativacao: s.data_desativacao,
        // a API real só devolve um valor de contexto ("valor", stringificado), não o
        // conjunto rico por indicador que o mock tem — cai num único campo.
        contexto: { valor: Number(s.contexto?.valor) },
        regra: {
          nome: s.regra_nome,
          descricao: s.regra_descricao,
          peso: 0, // não exposto pela API real (existe um cálculo no backend, mas sem rota pública)
          tom: tonePorNome(s.regra_nome),
        },
        backtest: bt
          ? {
              ocorrencias: bt.total_ocorrencias,
              ret5: bt.retorno_medio_5_pregoes != null ? Number(bt.retorno_medio_5_pregoes) : null,
              ret20: bt.retorno_medio_20_pregoes != null ? Number(bt.retorno_medio_20_pregoes) : null,
              ret60: bt.retorno_medio_60_pregoes != null ? Number(bt.retorno_medio_60_pregoes) : null,
            }
          : { ocorrencias: 0, ret5: null, ret20: null, ret60: null },
      };
    }),
  );
}

/** O 422 de quantidade insuficiente da API traz só o ativo_id no `detail` — troca por uma
 * mensagem legível, mantendo as demais validações (ex: data futura) como vieram. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function traduzirErroOperacao(err, mensagem) {
  if (err.status === 422 && UUID_RE.test(err.message)) err.message = mensagem;
  throw err;
}

// a API devolve percentuais como fração decimal em string ("0.159" = 15,9%).
const fracaoParaPct = (v) => (v == null ? null : Number(v) * 100);

const PERIODO_TAMANHO = { '1d': 2, '1s': 6, '1m': 24, '3m': 68, '1a': 254, '5a': Infinity };

const mapCotacao = (ticker, cot) => ({
  ticker,
  preco: Number(cot.preco),
  variacao: Number(cot.variacao),
  variacao_pct: Number(cot.variacao_percentual),
  volume: Number(cot.volume),
  data_hora: new Date().toISOString(),
});

// a API real não devolve uma cor por regra (isso é só estética do mock) — deriva uma tom
// consistente a partir do nome da regra, pra pelo menos não repetir a mesma cor sempre.
const TONS_SINAL = ['blue', 'orange', 'green', 'purple', 'yellow'];
function tonePorNome(nome) {
  let hash = 0;
  for (let i = 0; i < (nome || '').length; i++) hash = (hash * 31 + nome.charCodeAt(i)) | 0;
  return TONS_SINAL[Math.abs(hash) % TONS_SINAL.length];
}

/** Busca o histórico real (em 3M, o maior período do plano gratuito da brapi) e
 * calcula os indicadores localmente com `computeIndicators` — a API tem um endpoint de
 * indicadores, mas ele devolve só o valor atual de cada um, não a série por candle que os
 * gráficos precisam, então reaproveitar o cálculo local é mais simples e fica consistente. */
async function fetchRealCandlesEIndicadores(ativoId) {
  // a brapi no plano gratuito só aceita 1M e 3M — 3M é o maior lookback possível (dá pra SMA 20/50;
  // a SMA 200 fica vazia). O recorte por período (1M/3M) é feito por quem chama.
  const pontos = await apiFetch(`/ativos/${ativoId}/historico?periodo=3M`);
  const candles = pontos
    .map((p) => ({
      time: p.data.slice(0, 10),
      open: Number(p.abertura),
      high: Number(p.maxima),
      low: Number(p.minima),
      close: Number(p.fechamento),
      volume: Number(p.volume),
    }))
    // a API devolve do mais recente pro mais antigo; o gráfico (lightweight-charts) exige ordem crescente.
    .sort((a, b) => a.time.localeCompare(b.time));
  return { candles, ind: computeIndicators(candles) };
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let readAlerts = new Set();
const hAgo = (n) => new Date(Date.now() - n * 3600_000).toISOString();
let sessions = [
  { id: 'se1', dispositivo: 'Chrome · Windows', local: 'São Paulo, BR', atual: true, ultimo_acesso: new Date().toISOString() },
  { id: 'se2', dispositivo: 'App · iPhone', local: 'São Paulo, BR', atual: false, ultimo_acesso: hAgo(6) },
  { id: 'se3', dispositivo: 'Edge · Windows', local: 'Campinas, BR', atual: false, ultimo_acesso: hAgo(72) },
];

const quoteOf = (ticker) => {
  const candles = generateCandles(ticker);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const variacao = last.close - prev.close;
  return {
    ticker,
    preco: last.close,
    variacao: +variacao.toFixed(2),
    variacao_pct: +((variacao / prev.close) * 100).toFixed(2),
    volume: last.volume,
    data_hora: new Date().toISOString(),
  };
};

const seriesOf = (ticker) => {
  const candles = generateCandles(ticker);
  const ind = computeIndicators(candles);
  return { candles, ind };
};

export const api = {
  /* ----- autenticação (RF-01, RF-02) ----- */
  async login({ email, senha }) {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    return {
      token: data.access_token,
      refreshToken: data.refresh_token,
      // o backend não devolve o nome no login — deriva do e-mail, como a UI já espera.
      usuario: { id: decodeJwtSub(data.access_token), nome: email.split('@')[0].replace(/^./, (c) => c.toUpperCase()), email },
    };
  },
  async register({ nome, email, senha }) {
    try {
      const data = await apiFetch('/usuarios', { method: 'POST', body: JSON.stringify({ nome, email, senha }) });
      return {
        token: data.access_token,
        refreshToken: data.refresh_token,
        usuario: { id: decodeJwtSub(data.access_token), nome, email },
      };
    } catch (err) {
      if (err.status === 409) err.code = 'EMAIL_EXISTS';
      throw err;
    }
  },
  async logout() {
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) return;
    // logout é best-effort: mesmo se o backend falhar, a sessão local é encerrada por quem chamou.
    await apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }).catch(() => {});
  },
  async recoverPassword({ email }) {
    await delay(520);
    if (!EMAIL_RE.test((email || '').trim())) throw new Error('Informe um e-mail válido.');
    // Resposta sempre genérica — não revela se o e-mail está cadastrado.
    return { ok: true };
  },
  async updateProfile({ nome, email }) {
    await delay(420);
    if (!nome?.trim()) throw new Error('Informe seu nome.');
    if (!email?.includes('@')) throw new Error('Informe um e-mail válido.');
    return { nome: nome.trim(), email: email.trim() };
  },
  async changePassword({ atual, nova }) {
    await delay(480);
    if (!atual) throw new Error('Informe sua senha atual.');
    if (!nova || nova.length < 8) throw new Error('A nova senha precisa ter ao menos 8 caracteres.');
    return { ok: true };
  },
  async getSessions() {
    await delayRead();
    return [...sessions].sort((a, b) => Number(b.atual) - Number(a.atual));
  },
  async revokeSession(id) {
    await delay(260);
    sessions = sessions.filter((s) => s.id !== id);
    return { ok: true };
  },
  async revokeOtherSessions() {
    await delay(340);
    sessions = sessions.filter((s) => s.atual);
    return { ok: true };
  },

  /* ----- ativos (RF-04, RF-05, RF-06) ----- */
  async searchAssets(termo) {
    const t = (termo || '').trim();
    // a API não tem um endpoint de "listar todos" — sem termo, não tem o que buscar de verdade.
    if (!t) return [];
    // a busca real não devolve preço (só a cotação por ativo_id tem isso, e resultado de busca
    // ainda não tem um ativo_id — só ganha um ao ser adicionado à watchlist). SearchPage.jsx
    // mostra 0,00 na coluna de preço pra esses itens até lá.
    return apiFetch(`/ativos/buscar?termo=${encodeURIComponent(t)}`);
  },
  async getAsset(ticker) {
    const cached = await resolverAtivoCache(ticker);
    if (!cached) {
      await delayRead();
      const asset = byTicker(ticker);
      if (!asset) throw new Error('Ativo não encontrado.');
      return { ...asset, cotacao: quoteOf(asset.ticker) };
    }
    const cot = await apiFetch(`/ativos/${cached.id}/cotacao`);
    return {
      ticker,
      nome: cached.nome,
      tipo: cached.tipo,
      setor: cached.setor,
      moeda: cached.moeda,
      fonte: cached.tipo === 'CRIPTO' ? 'Binance' : 'brapi',
      cotacao: mapCotacao(ticker, cot),
    };
  },
  async getQuotes(tickers) {
    await delay(240);
    return tickers.map(quoteOf);
  },
  async getHistory(ticker, periodo = '1a') {
    const cached = await resolverAtivoCache(ticker);
    if (!cached) {
      await delayRead();
      const { candles, ind } = seriesOf(ticker);
      const sizes = { '1d': 2, '1s': 6, '1m': 24, '3m': 68, '1a': 254, '5a': candles.length };
      const n = Math.min(sizes[periodo] ?? 254, candles.length);
      const from = candles.length - n;
      const slice = (arr) => arr.slice(from);
      return {
        candles: candles.slice(from),
        indicators: {
          sma20: slice(ind.sma20),
          sma50: slice(ind.sma50),
          sma200: slice(ind.sma200),
          rsi14: slice(ind.rsi14),
          macd: { line: slice(ind.macd.line), signal: slice(ind.macd.signal), hist: slice(ind.macd.hist) },
          bollinger: { mid: slice(ind.bollinger.mid), upper: slice(ind.bollinger.upper), lower: slice(ind.bollinger.lower) },
          volRel: slice(ind.volRel),
        },
      };
    }
    const { candles, ind } = await fetchRealCandlesEIndicadores(cached.id);
    const n = Math.min(PERIODO_TAMANHO[periodo] ?? 254, candles.length);
    const from = candles.length - n;
    const slice = (arr) => arr.slice(from);
    return {
      candles: candles.slice(from),
      indicators: {
        sma20: slice(ind.sma20),
        sma50: slice(ind.sma50),
        sma200: slice(ind.sma200),
        rsi14: slice(ind.rsi14),
        macd: { line: slice(ind.macd.line), signal: slice(ind.macd.signal), hist: slice(ind.macd.hist) },
        bollinger: { mid: slice(ind.bollinger.mid), upper: slice(ind.bollinger.upper), lower: slice(ind.bollinger.lower) },
        volRel: slice(ind.volRel),
      },
    };
  },
  async getIndicatorSnapshot(ticker) {
    const cached = await resolverAtivoCache(ticker);
    if (!cached) {
      await delayRead();
      const { ind } = seriesOf(ticker);
      return {
        'SMA (20)': lastDefined(ind.sma20),
        'SMA (50)': lastDefined(ind.sma50),
        'SMA (200)': lastDefined(ind.sma200),
        'RSI (14)': lastDefined(ind.rsi14),
        'MACD (12,26,9)': lastDefined(ind.macd.line),
        'Sinal MACD': lastDefined(ind.macd.signal),
        'Bollinger sup.': lastDefined(ind.bollinger.upper),
        'Bollinger inf.': lastDefined(ind.bollinger.lower),
        'Volume relativo': lastDefined(ind.volRel),
      };
    }
    // valores calculados pelo backend (GET /ativos/{id}/indicadores) — a série por candle
    // dos gráficos continua sendo calculada localmente a partir do histórico real.
    const lista = await apiFetch(`/ativos/${cached.id}/indicadores`);
    const ind = (tipo, periodo) =>
      lista.find((i) => i.tipo === tipo && (periodo == null || i.parametros?.periodo === periodo));
    const num = (v) => (v == null ? null : Number(v));
    const macd = ind('MACD');
    const boll = ind('BOLLINGER');
    return {
      'SMA (20)': num(ind('SMA', 20)?.valor),
      'SMA (50)': num(ind('SMA', 50)?.valor),
      'SMA (200)': num(ind('SMA', 200)?.valor),
      'RSI (14)': num(ind('RSI', 14)?.valor),
      'MACD (12,26,9)': num(macd?.valor),
      'Sinal MACD': num(macd?.valores_auxiliares?.linha_sinal),
      'Bollinger sup.': num(boll?.valores_auxiliares?.banda_superior),
      'Bollinger inf.': num(boll?.valores_auxiliares?.banda_inferior),
      'Volume relativo': num(ind('VOLUME_RELATIVO')?.valor),
    };
  },

  /* ----- sinais (RF-07, RF-08) ----- */
  async getSignals({ ticker, apenasAtivos = true } = {}) {
    if (!ticker) {
      // visão geral (Dashboard / página de alertas): junta os sinais reais de cada ativo da watchlist.
      await carregarWatchlistIndex();
      const porAtivo = await Promise.all(
        [...watchlistIndex.entries()].map(([t, info]) => sinaisReais(t, info.id, apenasAtivos).catch(() => [])),
      );
      return porAtivo.flat().sort((a, b) => b.data_ativacao.localeCompare(a.data_ativacao));
    }
    const cached = await resolverAtivoCache(ticker);
    if (!cached) {
      // ativo fora da watchlist não tem ativo_id na API — sem como buscar sinal real.
      await delayRead();
      return SIGNALS.filter((s) => s.ticker === ticker && (!apenasAtivos || !s.data_desativacao)).map((s) => ({
        ...s,
        regra: ruleOf(s.regra_id),
        backtest: BACKTESTS[s.regra_id],
      }));
    }
    return sinaisReais(ticker, cached.id, apenasAtivos);
  },
  async getRules() {
    await delay(140);
    return RULES;
  },
  async getScore(ticker) {
    await delayRead();
    const ativos = SIGNALS.filter((s) => s.ticker === ticker && !s.data_desativacao);
    const soma = ativos.reduce((a, s) => a + (ruleOf(s.regra_id)?.peso ?? 0), 0);
    return { score: +Math.min(soma * 100, 100).toFixed(0), sinais: ativos.length };
  },
  async getTopMovers(limit = 5) {
    await delayRead();
    const quotes = ASSETS.map((a) => ({ ...quoteOf(a.ticker), nome: a.nome, tipo: a.tipo }));
    return {
      altas: [...quotes].sort((a, b) => b.variacao_pct - a.variacao_pct).slice(0, limit),
      baixas: [...quotes].sort((a, b) => a.variacao_pct - b.variacao_pct).slice(0, limit),
    };
  },
  /** Rankings de mercado (RF-05 a RF-08) — altas, baixas, volume relativo e sinais, no estilo dos rankings do investidor10. */
  async getRankings(limit = 6) {
    await delayRead();
    const quotes = ASSETS.map((a) => ({ ...quoteOf(a.ticker), nome: a.nome, tipo: a.tipo }));
    const comIndicadores = ASSETS.map((a) => {
      const ind = computeIndicators(generateCandles(a.ticker));
      return { ticker: a.ticker, nome: a.nome, tipo: a.tipo, volRel: lastDefined(ind.volRel) ?? 0 };
    });
    const comSinais = ASSETS.map((a) => ({
      ticker: a.ticker,
      nome: a.nome,
      tipo: a.tipo,
      sinais: SIGNALS.filter((s) => s.ticker === a.ticker && !s.data_desativacao).length,
    }));
    return {
      altas: [...quotes].sort((a, b) => b.variacao_pct - a.variacao_pct).slice(0, limit),
      baixas: [...quotes].sort((a, b) => a.variacao_pct - b.variacao_pct).slice(0, limit),
      volume: [...comIndicadores].sort((a, b) => b.volRel - a.volRel).slice(0, limit),
      sinais: comSinais
        .filter((s) => s.sinais > 0)
        .sort((a, b) => b.sinais - a.sinais)
        .slice(0, limit),
    };
  },
  /** Notícias de mercado (opcionalmente filtradas por ativo). */
  async getNews(ticker, limit = 8) {
    await delayRead();
    return NEWS.filter((n) => !ticker || n.ticker === ticker)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, limit);
  },

  /* ----- watchlist (RF-03, RN-08) ----- */
  async getWatchlist() {
    const items = await carregarWatchlistIndex();
    return Promise.all(
      items.map(async (it) => {
        const sinais = await apiFetch(`/ativos/${it.ativo.id}/sinais`)
          .then((lista) => lista.filter((s) => !s.data_desativacao).length)
          .catch(() => 0);
        // se a cotação real falhar (ex: BrAPI fora do ar, 503), cai pro mock em vez de quebrar a lista inteira.
        const cotacao = await apiFetch(`/ativos/${it.ativo.id}/cotacao`)
          .then((cot) => mapCotacao(it.ativo.ticker, cot))
          .catch(() => quoteOf(it.ativo.ticker));
        return {
          ticker: it.ativo.ticker,
          nome: it.ativo.nome,
          tipo: it.ativo.tipo,
          setor: it.ativo.setor,
          moeda: it.ativo.moeda,
          notificar: it.notificar,
          adicionado_em: it.adicionado_em,
          cotacao,
          sinais,
        };
      }),
    );
  },
  async addToWatchlist(ticker) {
    await apiFetch('/watchlist', { method: 'POST', body: JSON.stringify({ ticker }) });
    return { ok: true };
  },
  async removeFromWatchlist(ticker) {
    const entry = watchlistIndex.get(ticker);
    await apiFetch(`/watchlist/${entry.id}`, { method: 'DELETE' });
    watchlistIndex.delete(ticker);
    return { ok: true };
  },
  async toggleNotify(ticker) {
    const entry = watchlistIndex.get(ticker);
    const data = await apiFetch(`/watchlist/${entry.id}/notificacao`, {
      method: 'PATCH',
      body: JSON.stringify({ notificar: !entry.notificar }),
    });
    entry.notificar = data.notificar;
    return { ok: true };
  },

  /* ----- portfólio (RF-10, RF-11, RF-12) ----- */
  async getOperations() {
    const [ops, posicoes] = await Promise.all([
      apiFetch('/operacoes'),
      apiFetch('/portfolio/posicoes').catch(() => []),
      carregarWatchlistIndex().catch(() => []),
    ]);
    // a operação só traz ativo_id — o ticker vem da watchlist ou das posições.
    const tickerPorId = new Map([
      ...posicoes.map((p) => [p.ativo_id, p.ticker]),
      ...[...watchlistIndex.entries()].map(([t, info]) => [info.id, t]),
    ]);
    return ops
      .map((o) => ({
        id: o.id,
        ativo_id: o.ativo_id,
        ticker: tickerPorId.get(o.ativo_id) ?? '—',
        tipo: o.tipo,
        quantidade: Number(o.quantidade),
        preco_unitario: Number(o.preco_unitario),
        data: o.data,
        criado_em: o.criado_em,
      }))
      .sort((a, b) => b.data.localeCompare(a.data));
  },
  async createOperation(op) {
    let cached = await resolverAtivoCache(op.ticker);
    if (!cached) {
      // a API só cria o ativo (e lhe dá um ativo_id) quando ele entra na watchlist.
      await apiFetch('/watchlist', { method: 'POST', body: JSON.stringify({ ticker: op.ticker }) });
      await carregarWatchlistIndex();
      cached = watchlistIndex.get(op.ticker);
    }
    return apiFetch('/operacoes', {
      method: 'POST',
      body: JSON.stringify({
        ativo_id: cached.id,
        tipo: op.tipo,
        quantidade: String(op.quantidade),
        preco_unitario: String(op.preco_unitario),
        data: op.data,
      }),
    }).catch((err) => traduzirErroOperacao(err, 'Quantidade insuficiente em carteira para essa venda nessa data.'));
  },
  async deleteOperation(id) {
    await apiFetch(`/operacoes/${id}`, { method: 'DELETE' }).catch((err) =>
      traduzirErroOperacao(err, 'Não é possível excluir: vendas posteriores ficariam sem quantidade em carteira.'),
    );
    return { ok: true };
  },
  async getPositions() {
    const [posicoes] = await Promise.all([apiFetch('/portfolio/posicoes'), carregarWatchlistIndex().catch(() => [])]);
    const lista = await Promise.all(
      posicoes.map(async (p) => {
        const info = watchlistIndex.get(p.ticker) ?? {};
        // variação do dia não vem na posição — sai da cotação atual do ativo.
        const cot = await apiFetch(`/ativos/${p.ativo_id}/cotacao`).catch(() => null);
        const quantidade = Number(p.quantidade);
        const precoMedio = Number(p.preco_medio);
        const custo = quantidade * precoMedio;
        const valorAtual = Number(p.valor_mercado);
        const valorBrl = Number(p.valor_mercado_brl);
        const resultado = Number(p.lucro_nao_realizado);
        const cambio = valorAtual ? valorBrl / valorAtual : 1;
        return {
          ticker: p.ticker,
          ativo_id: p.ativo_id,
          quantidade,
          custo,
          nome: info.nome ?? p.ticker,
          tipo: info.tipo ?? 'ACAO',
          setor: info.setor ?? '—',
          setorLabel: info.setor || info.tipo || '—',
          moeda: info.moeda ?? 'BRL',
          preco_medio: precoMedio,
          preco_atual: Number(p.cotacao_atual),
          variacao_pct: cot ? Number(cot.variacao_percentual) : 0,
          valor_atual: valorAtual,
          resultado,
          resultado_pct: custo ? (resultado / custo) * 100 : 0,
          lucro_realizado: Number(p.lucro_realizado),
          valor_atual_brl: valorBrl,
          custo_brl: custo * cambio,
        };
      }),
    );
    return lista.filter((p) => p.quantidade > 0).sort((a, b) => b.valor_atual_brl - a.valor_atual_brl);
  },
  async getPortfolioSummary() {
    const [r, cdi, ibov, pos, ops] = await Promise.all([
      apiFetch('/portfolio/rentabilidade'),
      apiFetch('/portfolio/benchmark?benchmark=CDI').catch(() => null),
      apiFetch('/portfolio/benchmark?benchmark=IBOVESPA').catch(() => null),
      this.getPositions(),
      apiFetch('/operacoes').catch(() => []),
    ]);
    const pct = fracaoParaPct(r.percentual) ?? 0;
    const pctCdi = fracaoParaPct(cdi?.rentabilidade_benchmark_percentual) ?? 0;
    const pctIbov = fracaoParaPct(ibov?.rentabilidade_benchmark_percentual) ?? 0;
    const valorTotal = Number(r.valor_mercado_brl);
    const pesoTotal = pos.reduce((a, p) => a + p.valor_atual_brl, 0);
    const variacaoDia = pesoTotal ? pos.reduce((a, p) => a + p.variacao_pct * p.valor_atual_brl, 0) / pesoTotal : 0;
    // a API devolve só a rentabilidade acumulada (não uma série histórica): o gráfico liga
    // o início (base 100, data da 1ª operação) ao valor de hoje, para carteira e benchmarks.
    const hoje = new Date().toISOString().slice(0, 10);
    const inicio = ops.map((o) => o.data).sort()[0] ?? hoje;
    return {
      valor_total: valorTotal,
      custo_total: Number(r.custo_base_brl),
      resultado: Number(r.lucro_nao_realizado_brl) + Number(r.lucro_realizado_brl),
      resultado_pct: pct,
      variacao_dia_pct: variacaoDia,
      benchmarks: { cdi: pctCdi, ibovespa: pctIbov },
      curva: [
        { data: inicio, carteira: 100, ibovespa: 100, cdi: 100 },
        { data: hoje, carteira: +(100 + pct).toFixed(2), ibovespa: +(100 + pctIbov).toFixed(2), cdi: +(100 + pctCdi).toFixed(2) },
      ],
    };
  },
  async getDistribution() {
    const [d, r] = await Promise.all([apiFetch('/portfolio/distribuicao'), apiFetch('/portfolio/rentabilidade')]);
    const total = Number(r.valor_mercado_brl);
    const grupo = (obj) =>
      Object.entries(obj ?? {})
        .map(([nome, fracao]) => ({ nome, valor: +(Number(fracao) * total).toFixed(2), pct: +(Number(fracao) * 100).toFixed(1) }))
        .sort((a, b) => b.valor - a.valor);
    return { classe: grupo(d.por_classe), setor: grupo(d.por_setor), moeda: grupo(d.por_moeda) };
  },

  /* ----- alertas (RF-09) ----- */
  async getAlerts() {
    const [sinais, notificacoes] = await Promise.all([this.getSignals({ apenasAtivos: false }), apiFetch('/notificacoes')]);
    notificacoesSinal = new Map(
      notificacoes.filter((n) => n.tipo === 'SINAL_ATIVADO' && n.contexto?.sinal_id).map((n) => [n.contexto.sinal_id, n]),
    );
    return sinais.map((s) => {
      const notif = notificacoesSinal.get(s.id);
      return {
        id: s.id,
        ticker: s.ticker,
        regra: s.regra,
        contexto: s.contexto,
        backtest: s.backtest,
        data: s.data_ativacao,
        ativo: !s.data_desativacao,
        // "lido" vem da notificação do sinal no backend; sinal sem notificação (ex: ativo com
        // aviso desligado na watchlist) só pode ser marcado como lido localmente.
        lido: notif ? notif.lida || readAlerts.has(s.id) : readAlerts.has(s.id),
      };
    });
  },
  async markAlertRead(id) {
    readAlerts = new Set([...readAlerts, id]);
    const notif = notificacoesSinal.get(id);
    if (notif && !notif.lida) await apiFetch(`/notificacoes/${notif.id}/lida`, { method: 'PATCH' });
    return { ok: true };
  },
  async markAllAlertsRead() {
    const pendentes = [...notificacoesSinal.values()].filter((n) => !n.lida);
    await Promise.all(pendentes.map((n) => apiFetch(`/notificacoes/${n.id}/lida`, { method: 'PATCH' })));
    readAlerts = new Set([...readAlerts, ...notificacoesSinal.keys()]);
    return { ok: true };
  },

  /* ----- alertas de preço do usuário (API real: /alertas e /notificacoes) -----
   * O backend só suporta condição de preço (≥ / ≤), entregue in-app via WebSocket. Quem
   * avalia as regras é o scheduler do backend — o front só cadastra e lista. */
  async getUserRules() {
    const alertas = await apiFetch('/alertas');
    alertasIndex = new Map(alertas.map((a) => [a.id, a]));
    // uma cotação por ativo distinto (não por alerta), pra mostrar o "valor atual" e o progresso.
    const ids = [...new Set(alertas.map((a) => a.ativo.id))];
    const precos = new Map(
      await Promise.all(
        ids.map(async (id) => [id, await apiFetch(`/ativos/${id}/cotacao`).then((c) => Number(c.preco)).catch(() => null)]),
      ),
    );
    return alertas
      .map((a) => {
        const operador = a.tipo_condicao === 'PRECO_MAIOR_IGUAL' ? 'GTE' : 'LTE';
        const valor = Number(a.valor_alvo);
        const atual = precos.get(a.ativo.id);
        const fmt = (v) => (v == null ? '—' : fmtBRL(v, a.moeda_alvo));
        const atingido = atual == null ? a.ultimo_estado : operador === 'GTE' ? atual >= valor : atual <= valor;
        return {
          id: a.id,
          ticker: a.ativo.ticker,
          ativo: a.ativo,
          metrica: 'PRECO',
          operador,
          valor,
          ativa: a.habilitado,
          criada_em: a.criado_em,
          disparado_em: a.disparado_em,
          avaliacao: {
            valor_atual: atual,
            valor_atual_label: fmt(atual),
            alvo_label: fmt(valor),
            atingido,
            progresso:
              atual == null || !valor ? 0 : Math.max(0, Math.min(100, (operador === 'GTE' ? atual / valor : valor / atual) * 100)),
            condicao: `Preço ${operador === 'GTE' ? '≥' : '≤'} ${fmt(valor)}`,
            moeda: a.moeda_alvo,
          },
        };
      })
      .sort((a, b) => Number(b.ativa) - Number(a.ativa) || b.criada_em.localeCompare(a.criada_em));
  },
  async createUserRule({ ticker, operador, valor }) {
    const a = await apiFetch('/alertas', {
      method: 'POST',
      body: JSON.stringify({
        ticker,
        tipo_condicao: operador === 'GTE' ? 'PRECO_MAIOR_IGUAL' : 'PRECO_MENOR_IGUAL',
        valor_alvo: String(valor),
      }),
    });
    // o disparo nunca é imediato aqui: chega pelo WebSocket no próximo ciclo do scheduler.
    return { ...a, disparo: null };
  },
  async toggleUserRule(id) {
    const atual = alertasIndex.get(id);
    await apiFetch(`/alertas/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !atual?.habilitado }) });
    return { ok: true };
  },
  async updateUserRule(id, { operador, valor }) {
    if (!(Number(valor) > 0)) throw new Error('Informe um valor-alvo maior que zero.');
    return apiFetch(`/alertas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        tipo_condicao: operador === 'GTE' ? 'PRECO_MAIOR_IGUAL' : 'PRECO_MENOR_IGUAL',
        valor_alvo: String(valor),
      }),
    });
  },
  async deleteUserRule(id) {
    await apiFetch(`/alertas/${id}`, { method: 'DELETE' });
    return { ok: true };
  },
  async getUserTriggers() {
    const notificacoes = await apiFetch('/notificacoes');
    return notificacoes.slice(0, 20).map(mapNotificacao);
  },
  async marcarTriggersVistos() {
    const notificacoes = await apiFetch('/notificacoes');
    await Promise.all(
      notificacoes.filter((n) => !n.lida).map((n) => apiFetch(`/notificacoes/${n.id}/lida`, { method: 'PATCH' })),
    );
    return { ok: true };
  },

  /* ----- web push (RF-18) ----- */
  async getChavePublicaWebPush() {
    return apiFetch('/web-push/chave-publica');
  },
  async registrarInscricaoWebPush(inscricao) {
    return apiFetch('/web-push/inscricoes', { method: 'POST', body: JSON.stringify(inscricao) });
  },
  async removerInscricaoWebPush(endpoint) {
    await apiFetch(`/web-push/inscricoes?endpoint=${encodeURIComponent(endpoint)}`, { method: 'DELETE' });
    return { ok: true };
  },

  /* ----- IA (RF-13, RF-14, RF-15) ----- */
  /** RF-13/RF-14/RNF-02 — texto gerado deterministicamente a partir dos indicadores
   * reais do ativo (nunca fixture estática). UC-03 alternativo: com o toggle de
   * desenvolvedor "IA indisponível" ligado, simula falha do provedor. */
  async getAssetAnalysis(ticker) {
    const cached = await resolverAtivoCache(ticker);
    if (cached) {
      // Gemini no plano gratuito leva de 5 a 48 s — timeout folgado pra não abortar antes do backend.
      const a = await apiFetch(`/ativos/${cached.id}/analise`, { timeoutMs: 70_000 });
      return {
        texto: a.texto,
        provedor: 'gemini',
        modelo: a.modelo,
        em_cache: a.em_cache,
        gerado_em: a.gerado_em,
        disclaimer: a.aviso_legal,
      };
    }
    await delay(900);
    if (useUiStore.getState().iaIndisponivel) {
      throw new Error('Serviço de análise por IA temporariamente indisponível.');
    }
    return {
      texto: gerarAnaliseAtivo(ticker),
      provedor: 'mock',
      modelo: 'fixtures-v1',
      prompt_versao: 'v1.0',
      gerado_em: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    };
  },
  async getDailySummary() {
    // o resumo diário é gerado pelo scheduler do backend e entregue como notificação RESUMO_DIARIO.
    const notificacoes = await apiFetch('/notificacoes');
    const ultimo = notificacoes
      .filter((n) => n.tipo === 'RESUMO_DIARIO')
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
    if (!ultimo) return null;
    return {
      texto: ultimo.contexto?.texto ?? ultimo.mensagem,
      disclaimer: ultimo.contexto?.aviso_legal ?? DISCLAIMER,
      gerado_em: ultimo.criado_em,
    };
  },
  /** RF-15/UC-06 — chat com a IA do backend (POST /chat), que consulta a carteira do usuário.
   * `historico` são as mensagens anteriores da conversa ({papel, texto}). */
  async askAI(pergunta, historico = []) {
    // o backend aceita no máximo 20 mensagens, e a última precisa ser do usuário.
    const mensagens = [...historico, { papel: 'usuario', texto: pergunta }].slice(-20);
    const r = await apiFetch('/chat', { method: 'POST', body: JSON.stringify({ mensagens }), timeoutMs: 90_000 });
    return { texto: r.texto, ferramentas: [], disclaimer: r.aviso_legal, modelo: r.modelo };
  },
};

/* ----- análise textual gerada deterministicamente (RF-13, RF-14, RNF-02) -----
 * Monta o parágrafo a partir dos indicadores calculados de verdade — nunca um
 * texto fixo por ticker. Linguagem estritamente factual (RN-01): descreve a
 * condição técnica e o valor observado, sem linguagem de recomendação. */

function gerarAnaliseAtivo(ticker) {
  const { candles, ind } = seriesOf(ticker);
  const last = candles[candles.length - 1];
  const rsi14 = lastDefined(ind.rsi14);
  const sma50 = lastDefined(ind.sma50);
  const volRel = lastDefined(ind.volRel);
  const bbUpper = lastDefined(ind.bollinger.upper);
  const bbLower = lastDefined(ind.bollinger.lower);
  const frases = [];

  if (rsi14 != null) {
    const faixa = rsi14 <= 30 ? 'na faixa de sobrevenda (≤ 30)' : rsi14 >= 70 ? 'na faixa de sobrecompra (≥ 70)' : 'em região neutra (entre 30 e 70)';
    frases.push(`O RSI(14) está em ${fmtNum(rsi14, 1)}, ${faixa}.`);
  }

  if (sma50 != null) {
    const dist = ((last.close - sma50) / sma50) * 100;
    frases.push(`O preço está ${fmtPct(dist)} em relação à média móvel de 50 períodos (${fmtNum(sma50, 2)}).`);
  }

  if (bbUpper != null && last.close >= bbUpper) {
    frases.push(`O fechamento tocou ou superou a banda superior de Bollinger (${fmtNum(bbUpper, 2)}).`);
  } else if (bbLower != null && last.close <= bbLower) {
    frases.push(`O fechamento tocou ou rompeu a banda inferior de Bollinger (${fmtNum(bbLower, 2)}).`);
  }

  if (volRel != null) frases.push(`O volume relativo é de ${fmtNum(volRel, 2)}× em relação à média de 20 pregões.`);

  const sinalAtivo = SIGNALS.find((s) => s.ticker === ticker && !s.data_desativacao);
  if (sinalAtivo) {
    const regra = ruleOf(sinalAtivo.regra_id);
    const bt = BACKTESTS[sinalAtivo.regra_id];
    const horas = Math.max(1, Math.round((Date.now() - new Date(sinalAtivo.data_ativacao).getTime()) / 3_600_000));
    const contexto = Object.entries(sinalAtivo.contexto)
      .map(([k, v]) => `${k} em ${fmtNum(v, 2)}`)
      .join(', ');
    frases.push(
      `O sinal "${regra.nome}" foi ativado há ${horas} h, com ${contexto} no momento da ativação. ` +
        `Em ${bt.ocorrencias} ocorrências desta mesma condição nos últimos 24 meses, o retorno médio observado foi de ` +
        `${fmtPct(bt.ret5)} em 5 pregões, ${fmtPct(bt.ret20)} em 20 pregões e ${fmtPct(bt.ret60)} em 60 pregões.`,
    );
  } else {
    frases.push('Não há sinal técnico ativo para este ativo no momento.');
  }

  return frases.join(' ');
}

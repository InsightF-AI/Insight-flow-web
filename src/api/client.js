/**
 * Camada de acesso a dados — ponto único de integração com o backend FastAPI (`/api/v1`,
 * via proxy do Vite). O que a API expõe vem dela; o que ela ainda não expõe (rankings de
 * mercado, score) fica fora da tela até o backend ter a rota. Notícias vêm do Google News.
 */
import { DISCLAIMER } from './mock/ai.js';
import { computeIndicators } from '../lib/indicators.js';
import { fmtBRL } from '../lib/format.js';
import { useAuthStore, useUiStore } from '../store/index.js';

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
  // RNF-10: o alternador "Forçar erro" (Configurações → Modo desenvolvedor) derruba só as leituras
  // (GET) — escritas ficam fora, pra não travar login/criação enquanto se testa o estado de erro.
  // Só vale em dev: num build publicado o card some e um valor salvo no navegador não teria onde ser desligado.
  if (import.meta.env.DEV && !fetchOptions.method && useUiStore.getState().forcarErro) {
    throw new Error('Falha ao carregar os dados. Verifique sua conexão e tente novamente.');
  }
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

/** Ativo fora da watchlist não tem ativo_id na API (só ganha um ao entrar nela): sem como buscar
 * histórico, indicadores, sinais ou análise reais — a tela do ativo pede pra adicioná-lo. */
function exigirNaWatchlist(cached) {
  if (cached) return cached;
  const err = new Error('Adicione o ativo à watchlist para ver os dados reais.');
  err.code = 'FORA_DA_WATCHLIST';
  throw err;
}

/** UC-03 alternativo: com o toggle de desenvolvedor "IA indisponível" ligado, simula falha do provedor. */
function simularIaIndisponivel() {
  if (import.meta.env.DEV && useUiStore.getState().iaIndisponivel) {
    throw new Error('Serviço de análise por IA temporariamente indisponível.');
  }
}

/* ---------- estado mutável da sessão (substituído pelo banco no backend) ---------- */
// ticker -> {id, notificar, nome, tipo, setor, moeda} do último getWatchlist().
// É também o único jeito que temos de resolver o UUID real de um ativo no backend: a API
// não expõe um endpoint pra buscar/criar um ativo por ticker fora do fluxo de watchlist, então
// cotação/histórico/indicadores/sinais só existem para ativos que já estão na watchlist —
// os demais (ex: resultado de busca ainda não adicionado) ficam sem esses dados até entrarem nela.
let watchlistIndex = new Map();
// ticker -> {id, nome, tipo, setor, moeda} do catálogo global de ativos (GET /ativos/catalogo).
let catalogoIndex = new Map();
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

async function carregarCatalogoIndex() {
  const items = await apiFetch('/ativos/catalogo');
  catalogoIndex = new Map(items.map((it) => [it.ticker, it]));
  return items;
}

async function resolverAtivoCatalogo(ticker) {
  if (!catalogoIndex.has(ticker)) await carregarCatalogoIndex().catch(() => []);
  return catalogoIndex.get(ticker);
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
let readAlerts = new Set();

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
  /* ----- ativos (RF-04, RF-05, RF-06) ----- */
  async getCatalogo() {
    return carregarCatalogoIndex();
  },
  async getCotacaoAtual(ativoId) {
    const cot = await apiFetch(`/ativos/${ativoId}/cotacao`);
    return Number(cot.preco);
  },
  async searchAssets(termo) {
    const t = (termo || '').trim();
    const catalogo = await carregarCatalogoIndex().catch(() => []);
    if (!t) return catalogo;
    const termoMin = t.toLowerCase();
    const locais = catalogo.filter(
      (a) => a.ticker.toLowerCase().includes(termoMin) || a.nome.toLowerCase().includes(termoMin),
    );
    // a busca externa não devolve preço nem ativo_id; SearchPage.jsx mostra "—" na coluna de preço.
    let externos;
    try {
      externos = await apiFetch(`/ativos/buscar?termo=${encodeURIComponent(t)}`);
    } catch (err) {
      if (locais.length > 0) return locais;
      throw err;
    }
    const vistos = new Set(locais.map((a) => a.ticker));
    return [...locais, ...externos.filter((a) => !vistos.has(a.ticker))];
  },
  async getAsset(ticker) {
    const cached = await resolverAtivoCache(ticker);
    if (!cached) {
      // fora da watchlist, a busca diz o que o ativo é — cotação, só depois de adicionado.
      const ativo = (await apiFetch(`/ativos/buscar?termo=${encodeURIComponent(ticker)}`)).find((a) => a.ticker === ticker);
      if (!ativo) throw new Error('Ativo não encontrado.');
      return { ...ativo, fonte: ativo.tipo === 'CRIPTO' ? 'Binance' : 'brapi', cotacao: null };
    }
    // cotação fora do ar (503 da fonte de mercado) não derruba a tela do ativo: o cabeçalho mostra "—".
    const cot = await apiFetch(`/ativos/${cached.id}/cotacao`).catch(() => null);
    return {
      ticker,
      nome: cached.nome,
      tipo: cached.tipo,
      setor: cached.setor,
      moeda: cached.moeda,
      fonte: cached.tipo === 'CRIPTO' ? 'Binance' : 'brapi',
      cotacao: cot ? mapCotacao(ticker, cot) : null,
    };
  },
  async getHistory(ticker, periodo = '1a') {
    const cached = exigirNaWatchlist(await resolverAtivoCache(ticker));
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
    const cached = exigirNaWatchlist(await resolverAtivoCache(ticker));
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
    const cached = exigirNaWatchlist(await resolverAtivoCache(ticker));
    return sinaisReais(ticker, cached.id, apenasAtivos);
  },

  /* ----- watchlist (RF-03, RN-08) ----- */
  async getWatchlist() {
    const items = await carregarWatchlistIndex();
    return Promise.all(
      items.map(async (it) => {
        const sinais = await apiFetch(`/ativos/${it.ativo.id}/sinais`)
          .then((lista) => lista.filter((s) => !s.data_desativacao).length)
          .catch(() => 0);
        // se a cotação real falhar (ex: BrAPI fora do ar, 503), fica null em vez de quebrar a lista inteira
        // — a UI mostra "—", como na tela do ativo (um preço simulado aqui passaria por real).
        const cotacao = await apiFetch(`/ativos/${it.ativo.id}/cotacao`)
          .then((cot) => mapCotacao(it.ativo.ticker, cot))
          .catch(() => null);
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
    try {
      await apiFetch('/watchlist', { method: 'POST', body: JSON.stringify({ ticker }) });
    } catch (err) {
      // 409 = já está na watchlist (ex: clique duplo, ou a lista na tela ainda não tinha recarregado).
      if (err.status !== 409) throw err;
    }
    return { ok: true };
  },
  async removeFromWatchlist(ticker) {
    const entry = await resolverAtivoCache(ticker);
    if (!entry) return { ok: true };
    try {
      await apiFetch(`/watchlist/${entry.id}`, { method: 'DELETE' });
    } catch (err) {
      // 404 = já tinha saído da watchlist (ex: removido em outra aba).
      if (err.status !== 404) throw err;
    }
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
  /** Manchetes reais do Google News sobre os ativos da watchlist (últimos 7 dias). A API não tem
   * rota de notícias e o Google não libera CORS: o RSS vem por /noticias/rss, que o Nginx do
   * container (e o Vite em dev) repassa ao Google News. */
  async getNews(tickers, limit = 6) {
    if (!tickers?.length) return [];
    if (import.meta.env.DEV && useUiStore.getState().forcarErro) {
      throw new Error('Falha ao carregar os dados. Verifique sua conexão e tente novamente.');
    }
    const params = new URLSearchParams({
      q: `${tickers.map((t) => `"${t}"`).join(' OR ')} when:7d`,
      hl: 'pt-BR',
      gl: 'BR',
      ceid: 'BR:pt-419',
    });
    const res = await fetch(`/noticias/rss?${params}`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res?.ok) throw new Error('Não foi possível carregar as notícias.');
    const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
    if (xml.querySelector('parsererror')) throw new Error('Não foi possível carregar as notícias.');
    return [...xml.querySelectorAll('item')]
      .map((item) => {
        const texto = (tag) => item.querySelector(tag)?.textContent.trim() ?? '';
        const fonte = texto('source');
        // o título do Google News termina em " - Veículo"; o veículo já aparece à parte no card.
        const titulo = fonte && texto('title').endsWith(` - ${fonte}`) ? texto('title').slice(0, -(fonte.length + 3)) : texto('title');
        const data = new Date(texto('pubDate'));
        return {
          id: texto('guid') || texto('link'),
          titulo,
          link: texto('link'),
          fonte,
          data: Number.isNaN(data.getTime()) ? null : data.toISOString(),
          ticker: tickers.find((t) => titulo.toUpperCase().includes(t)) ?? null,
        };
      })
      .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
      .slice(0, limit);
  },
  /** Rankings (RF-05 a RF-08) dos ativos da watchlist — a API não tem rota de ranking de mercado,
   * então ordena o que ela já devolve por ativo: cotação, sinais ativos e volume relativo. */
  async getRankings(limit = 6) {
    const lista = await api.getWatchlist();
    const comVolume = await Promise.all(
      lista.map(async (it) => {
        const id = watchlistIndex.get(it.ticker)?.id;
        const volRel = await apiFetch(`/ativos/${id}/indicadores`)
          .then((ind) => ind.find((i) => i.tipo === 'VOLUME_RELATIVO')?.valor)
          .catch(() => null);
        return { ...it, volRel: volRel == null ? null : Number(volRel) };
      }),
    );
    const ativos = comVolume.map((it) => ({
      ticker: it.ticker,
      nome: it.nome,
      tipo: it.tipo,
      variacao_pct: it.cotacao?.variacao_pct,
      volRel: it.volRel,
      sinais: it.sinais,
    }));
    // ativo sem cotação ou sem volume fica fora daquele ranking, em vez de entrar como 0.
    const comCotacao = ativos.filter((a) => a.variacao_pct != null);
    return {
      total: ativos.length,
      altas: comCotacao.filter((a) => a.variacao_pct > 0).sort((a, b) => b.variacao_pct - a.variacao_pct).slice(0, limit),
      baixas: comCotacao.filter((a) => a.variacao_pct < 0).sort((a, b) => a.variacao_pct - b.variacao_pct).slice(0, limit),
      volume: ativos.filter((a) => a.volRel != null).sort((a, b) => b.volRel - a.volRel).slice(0, limit),
      sinais: ativos.filter((a) => a.sinais > 0).sort((a, b) => b.sinais - a.sinais).slice(0, limit),
    };
  },

  /* ----- portfólio (RF-10, RF-11, RF-12) ----- */
  async getOperations() {
    const [ops, posicoes] = await Promise.all([
      apiFetch('/operacoes'),
      apiFetch('/portfolio/posicoes').catch(() => []),
      carregarWatchlistIndex().catch(() => []),
      carregarCatalogoIndex().catch(() => []),
    ]);
    // a operação só traz ativo_id — o ticker vem do catálogo, da watchlist ou das posições.
    const tickerPorId = new Map([
      ...[...catalogoIndex.values()].map((a) => [a.id, a.ticker]),
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
    let cached = (await resolverAtivoCache(op.ticker)) ?? (await resolverAtivoCatalogo(op.ticker));
    if (!cached) {
      // fora do catálogo, a API só cria o ativo (e lhe dá um ativo_id) quando ele entra na watchlist.
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
          // null quando a cotação falha — fica fora da média do dia em vez de contar como 0%.
          variacao_pct: cot ? Number(cot.variacao_percentual) : null,
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
    // benchmark que falhou (ou sem dado no período) fica null — a tela mostra "—", não 0%.
    const pctCdi = fracaoParaPct(cdi?.rentabilidade_benchmark_percentual);
    const pctIbov = fracaoParaPct(ibov?.rentabilidade_benchmark_percentual);
    const valorTotal = Number(r.valor_mercado_brl);
    // média do dia ponderada pelo valor, só entre as posições cuja cotação veio.
    const comCotacao = pos.filter((p) => p.variacao_pct != null);
    const pesoTotal = comCotacao.reduce((a, p) => a + p.valor_atual_brl, 0);
    const variacaoDia = pesoTotal
      ? comCotacao.reduce((a, p) => a + p.variacao_pct * p.valor_atual_brl, 0) / pesoTotal
      : null;
    const base100 = (v) => (v == null ? null : +(100 + v).toFixed(2));
    // a API devolve só a rentabilidade acumulada (não uma série histórica): o gráfico liga
    // o início (base 100, data da 1ª operação) ao valor de hoje, para carteira e benchmarks.
    const hoje = new Date().toISOString().slice(0, 10);
    const inicio = ops.map((o) => o.data).sort()[0] ?? hoje;
    return {
      valor_total: valorTotal,
      custo_total: Number(r.custo_base_brl),
      // `percentual` da API é o lucro não realizado sobre o custo — o valor acompanha o mesmo recorte.
      resultado: Number(r.lucro_nao_realizado_brl),
      resultado_pct: pct,
      lucro_realizado: Number(r.lucro_realizado_brl),
      variacao_dia_pct: variacaoDia,
      benchmarks: { cdi: pctCdi, ibovespa: pctIbov },
      curva: [
        { data: inicio, carteira: 100, ibovespa: pctIbov == null ? null : 100, cdi: pctCdi == null ? null : 100 },
        { data: hoje, carteira: base100(pct), ibovespa: base100(pctIbov), cdi: base100(pctCdi) },
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
  /** RF-13/RF-14 — análise do ativo gerada pela IA do backend. */
  async getAssetAnalysis(ticker) {
    const cached = exigirNaWatchlist(await resolverAtivoCache(ticker));
    simularIaIndisponivel();
    // Gemini no plano gratuito leva de 5 a 48 s — timeout folgado pra não abortar antes do backend.
    const a = await apiFetch(`/ativos/${cached.id}/analise`, { timeoutMs: 70_000 });
    return {
      texto: a.texto,
      provedor: 'gemini',
      modelo: a.modelo,
      em_cache: a.em_cache,
      // a IA falhou e o backend devolveu a última análise salva — a tela avisa a data dela.
      desatualizada: a.desatualizada,
      gerado_em: a.gerado_em,
      disclaimer: a.aviso_legal,
    };
  },
  async getDailySummary() {
    simularIaIndisponivel();
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

/**
 * Camada de acesso a dados — mock em memória.
 * Cada função simula latência de rede e substitui 1:1 um endpoint REST do backend
 * FastAPI descrito na documentação técnica (seção 6). Ponto único de integração:
 * troque os corpos por `fetch(`${import.meta.env.VITE_API_URL}/...`)`.
 */
import { ASSETS, byTicker, generateCandles, toBRL } from './mock/assets.js';
import { RULES, SIGNALS, BACKTESTS, ruleOf } from './mock/signals.js';
import { OPERATIONS, EQUITY_CURVE, WATCHLIST } from './mock/portfolio.js';
import { CHAT_FALLBACK, DISCLAIMER } from './mock/ai.js';
import { USER_RULES, USER_TRIGGERS, metricaOf, operadorOf } from './mock/userAlerts.js';
import { NEWS } from './mock/news.js';
import { USERS } from './mock/users.js';
import { computeIndicators, lastDefined } from '../lib/indicators.js';
import { fmtBRL, fmtPct, fmtNum, fmtDate } from '../lib/format.js';
import { useUiStore } from '../store/index.js';

const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));

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
let watchlist = [...WATCHLIST];
let operations = [...OPERATIONS];
let users = [...USERS];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let readAlerts = new Set();
let userRules = [...USER_RULES];
let userTriggers = [...USER_TRIGGERS];
let vistosTriggers = new Set();
/* ---------- agendador de reavaliação de regras (RF-18, RN-06, RN-11, RN-13) ---------- */
let baselineRegras = new Map(); // ruleId -> última condição avaliada (atingido/não)
let ultimoDisparoDiario = new Map(); // ruleId -> 'YYYY-MM-DD' do último disparo (frequência DIARIA)
const hAgo = (n) => new Date(Date.now() - n * 3600_000).toISOString();
let sessions = [
  { id: 'se1', dispositivo: 'Chrome · Windows', local: 'São Paulo, BR', atual: true, ultimo_acesso: new Date().toISOString() },
  { id: 'se2', dispositivo: 'App · iPhone', local: 'São Paulo, BR', atual: false, ultimo_acesso: hAgo(6) },
  { id: 'se3', dispositivo: 'Edge · Windows', local: 'Campinas, BR', atual: false, ultimo_acesso: hAgo(72) },
];

/** Avalia uma regra do usuário contra os indicadores vigentes do ativo. */
const evaluateRule = (rule) => {
  const asset = byTicker(rule.ticker);
  const candles = generateCandles(rule.ticker);
  const ind = computeIndicators(candles);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const sma20 = lastDefined(ind.sma20);
  const atual = {
    PRECO: last.close,
    VAR_DIA: ((last.close - prev.close) / prev.close) * 100,
    RSI: lastDefined(ind.rsi14),
    DIST_SMA20: sma20 ? ((last.close - sma20) / sma20) * 100 : null,
    VOL_REL: lastDefined(ind.volRel),
  }[rule.metrica];
  const atingido = rule.operador === 'GTE' ? atual >= rule.valor : atual <= rule.valor;
  const m = metricaOf(rule.metrica);
  const fmt = (v) =>
    v == null
      ? '—'
      : m.unidade === 'moeda'
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: asset.moeda }).format(v)
        : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}${m.unidade}`;
  return {
    valor_atual: atual,
    valor_atual_label: fmt(atual),
    alvo_label: fmt(rule.valor),
    atingido,
    // proximidade do alvo (0–100), na direção do operador
    progresso:
      atual == null || !rule.valor || !atual
        ? 0
        : Math.max(0, Math.min(100, (rule.operador === 'GTE' ? atual / rule.valor : rule.valor / atual) * 100)),
    condicao: `${m.label} ${operadorOf(rule.operador).simbolo} ${fmt(rule.valor)}`,
    moeda: asset.moeda,
  };
};

/** O cliente web só consegue entregar de verdade o canal PUSH (Notification API do
 * navegador). E-mail, mobile e bandeja do Windows exigiriam um backend/app nativo —
 * o disparo é registrado no histórico, mas marcado como simulado (nunca "entregue"). */
const statusEntregaCanal = (canal) => {
  if (canal !== 'PUSH') return 'simulado';
  if (typeof Notification === 'undefined') return 'indisponivel';
  return Notification.permission === 'granted' && useUiStore.getState().notificacoesPush ? 'entregue' : 'indisponivel';
};

/** Registra o disparo de uma regra do usuário e aplica RN-13 (frequência). */
const dispararGatilhoRegra = (rule) => {
  const avaliacao = evaluateRule(rule);
  const novo = {
    id: `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    regra_id: rule.id,
    ticker: rule.ticker,
    texto: `${avaliacao.condicao} — valor atual ${avaliacao.valor_atual_label}.`,
    canais: rule.canais,
    entrega: Object.fromEntries(rule.canais.map((c) => [c, statusEntregaCanal(c)])),
    data: new Date().toISOString(),
  };
  userTriggers = [novo, ...userTriggers];

  if (rule.frequencia === 'UMA_VEZ') {
    userRules = userRules.map((r) => (r.id === rule.id ? { ...r, ativa: false } : r));
  } else if (rule.frequencia === 'DIARIA') {
    ultimoDisparoDiario.set(rule.id, novo.data.slice(0, 10));
  }
  return novo;
};

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
  async login({ email }) {
    await delay(520);
    if (!email?.includes('@')) throw new Error('Informe um e-mail válido.');
    return {
      token: 'mock.jwt.token',
      usuario: { id: 'u1', nome: email.split('@')[0].replace(/^./, (c) => c.toUpperCase()), email },
    };
  },
  async register({ nome, email, senha }) {
    await delay(620);
    if (!nome?.trim()) throw new Error('Informe seu nome.');
    const emailNorm = (email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(emailNorm)) throw new Error('Informe um e-mail válido.');
    if (!senha || senha.length < 8) throw new Error('A senha precisa ter ao menos 8 caracteres.');
    if (users.some((u) => u.email.toLowerCase() === emailNorm)) {
      const err = new Error('Este e-mail já está cadastrado.');
      err.code = 'EMAIL_EXISTS';
      throw err;
    }
    const novo = { id: `u${Date.now()}`, nome: nome.trim(), email: emailNorm, criado_em: new Date().toISOString().slice(0, 10) };
    users = [...users, novo];
    return { token: 'mock.jwt.token', usuario: { id: novo.id, nome: novo.nome, email: novo.email } };
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
    await delayRead();
    const t = (termo || '').trim().toLowerCase();
    if (!t) return ASSETS;
    return ASSETS.filter((a) => a.ticker.toLowerCase().includes(t) || a.nome.toLowerCase().includes(t));
  },
  async getAsset(ticker) {
    await delayRead();
    const asset = byTicker(ticker);
    if (!asset) throw new Error('Ativo não encontrado.');
    return { ...asset, cotacao: quoteOf(asset.ticker) };
  },
  async getQuotes(tickers) {
    await delay(240);
    return tickers.map(quoteOf);
  },
  async getHistory(ticker, periodo = '1a') {
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
  },
  async getIndicatorSnapshot(ticker) {
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
  },

  /* ----- sinais (RF-07, RF-08) ----- */
  async getSignals({ ticker, apenasAtivos = true } = {}) {
    await delayRead();
    return SIGNALS.filter((s) => (!ticker || s.ticker === ticker) && (!apenasAtivos || !s.data_desativacao)).map((s) => ({
      ...s,
      regra: ruleOf(s.regra_id),
      backtest: BACKTESTS[s.regra_id],
    }));
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
    await delayRead();
    return watchlist.map((w) => {
      const asset = byTicker(w.ticker);
      const sinais = SIGNALS.filter((s) => s.ticker === w.ticker && !s.data_desativacao).length;
      return { ...w, ...asset, cotacao: quoteOf(w.ticker), sinais };
    });
  },
  async addToWatchlist(ticker) {
    await delay(300);
    if (!watchlist.some((w) => w.ticker === ticker))
      watchlist = [...watchlist, { ticker, notificar: true, adicionado_em: new Date().toISOString().slice(0, 10) }];
    return { ok: true };
  },
  async removeFromWatchlist(ticker) {
    await delay(260);
    watchlist = watchlist.filter((w) => w.ticker !== ticker);
    return { ok: true };
  },
  async toggleNotify(ticker) {
    await delay(180);
    watchlist = watchlist.map((w) => (w.ticker === ticker ? { ...w, notificar: !w.notificar } : w));
    return { ok: true };
  },

  /* ----- portfólio (RF-10, RF-11, RF-12) ----- */
  async getOperations() {
    await delayRead();
    return [...operations].sort((a, b) => b.data.localeCompare(a.data));
  },
  async createOperation(op) {
    await delay(620);
    const nova = { ...op, id: `o${Date.now()}`, criado_em: new Date().toISOString() };
    operations = [...operations, nova];
    return nova;
  },
  async deleteOperation(id) {
    await delay(260);
    operations = operations.filter((o) => o.id !== id);
    return { ok: true };
  },
  async getPositions() {
    await delayRead();
    const map = new Map();
    for (const op of operations) {
      const cur = map.get(op.ticker) ?? { ticker: op.ticker, quantidade: 0, custo: 0 };
      const q = op.tipo === 'COMPRA' ? op.quantidade : -op.quantidade;
      cur.quantidade += q;
      cur.custo += q * op.preco_unitario;
      map.set(op.ticker, cur);
    }
    return [...map.values()]
      .filter((p) => p.quantidade > 0.0000001)
      .map((p) => {
        const asset = byTicker(p.ticker);
        const cot = quoteOf(p.ticker);
        const precoMedio = p.custo / p.quantidade;
        const valorAtual = p.quantidade * cot.preco;
        return {
          ...p,
          nome: asset.nome,
          tipo: asset.tipo,
          setor: asset.setor,
          setorLabel: asset.setor === '—' ? asset.tipo : asset.setor,
          moeda: asset.moeda,
          preco_medio: +precoMedio.toFixed(2),
          preco_atual: cot.preco,
          variacao_pct: cot.variacao_pct,
          valor_atual: +valorAtual.toFixed(2),
          resultado: +(valorAtual - p.custo).toFixed(2),
          resultado_pct: +(((valorAtual - p.custo) / p.custo) * 100).toFixed(2),
          // agregados sempre em BRL (câmbio mockado)
          valor_atual_brl: +toBRL(valorAtual, asset.moeda).toFixed(2),
          custo_brl: +toBRL(p.custo, asset.moeda).toFixed(2),
        };
      })
      .sort((a, b) => b.valor_atual - a.valor_atual);
  },
  async getPortfolioSummary() {
    // Derivado de getPositions() — que já paga a latência simulada; evita somar dois
    // delays independentes (até ~1,6 s) para o que o usuário percebe como uma única busca.
    const pos = await this.getPositions();
    const valor = pos.reduce((a, p) => a + p.valor_atual_brl, 0);
    const custo = pos.reduce((a, p) => a + p.custo_brl, 0);
    const ultimo = EQUITY_CURVE[EQUITY_CURVE.length - 1];
    return {
      valor_total: +valor.toFixed(2),
      custo_total: +custo.toFixed(2),
      resultado: +(valor - custo).toFixed(2),
      resultado_pct: +(((valor - custo) / custo) * 100).toFixed(2),
      variacao_dia_pct: 0.84,
      benchmarks: { cdi: +(ultimo.cdi - 100).toFixed(2), ibovespa: +(ultimo.ibovespa - 100).toFixed(2) },
      curva: EQUITY_CURVE,
    };
  },
  async getDistribution() {
    // Mesma lógica de getPortfolioSummary — a latência já vem de getPositions().
    const pos = await this.getPositions();
    const total = pos.reduce((a, p) => a + p.valor_atual_brl, 0) || 1;
    const group = (key) => {
      const m = new Map();
      pos.forEach((p) => m.set(p[key], (m.get(p[key]) ?? 0) + p.valor_atual_brl));
      return [...m.entries()]
        .map(([nome, valor]) => ({ nome, valor: +valor.toFixed(2), pct: +((valor / total) * 100).toFixed(1) }))
        .sort((a, b) => b.valor - a.valor);
    };
    return { classe: group('tipo'), setor: group('setorLabel'), moeda: group('moeda') };
  },

  /* ----- alertas (RF-09) ----- */
  async getAlerts() {
    await delayRead();
    return SIGNALS.map((s) => ({
      id: s.id,
      ticker: s.ticker,
      regra: ruleOf(s.regra_id),
      contexto: s.contexto,
      backtest: BACKTESTS[s.regra_id],
      data: s.data_ativacao,
      ativo: !s.data_desativacao,
      lido: readAlerts.has(s.id),
    })).sort((a, b) => b.data.localeCompare(a.data));
  },
  async markAlertRead(id) {
    await delay(120);
    readAlerts = new Set([...readAlerts, id]);
    return { ok: true };
  },
  async markAllAlertsRead() {
    await delay(220);
    readAlerts = new Set([...readAlerts, ...SIGNALS.map((s) => s.id)]);
    return { ok: true };
  },

  /* ----- alertas definidos pelo usuário ----- */
  async getUserRules() {
    await delayRead();
    return userRules
      .map((r) => ({ ...r, ativo: byTicker(r.ticker), avaliacao: evaluateRule(r) }))
      .sort((a, b) => Number(b.ativa) - Number(a.ativa) || b.criada_em.localeCompare(a.criada_em));
  },
  async createUserRule(rule) {
    await delay(520);
    const nova = { ...rule, id: `ua${Date.now()}`, ativa: true, criada_em: new Date().toISOString() };
    userRules = [nova, ...userRules];
    const avaliacao = evaluateRule(nova);
    // se a condição já está satisfeita no momento da criação, o disparo é imediato
    const disparo = avaliacao.atingido ? dispararGatilhoRegra(nova) : null;
    baselineRegras.set(nova.id, avaliacao.atingido);
    return { ...nova, avaliacao, disparo };
  },
  async toggleUserRule(id) {
    await delay(200);
    userRules = userRules.map((r) => (r.id === id ? { ...r, ativa: !r.ativa } : r));
    return { ok: true };
  },
  async updateUserRule(id, patch) {
    await delay(480);
    if (!(Number(patch.valor) > 0)) throw new Error('Informe um valor-alvo maior que zero.');
    userRules = userRules.map((r) => (r.id === id ? { ...r, ...patch } : r));
    const atualizada = userRules.find((r) => r.id === id);
    const avaliacao = evaluateRule(atualizada);
    // RN-11: editar rearma a regra, mas não dispara na hora — mesmo que a condição já esteja
    // satisfeita, o disparo só ocorre na próxima transição de não-atendida para atendida. Por
    // isso o agendador precisa "esquecer" o estado anterior e recomeçar do valor pós-edição.
    baselineRegras.set(id, avaliacao.atingido);
    return { ...atualizada, avaliacao };
  },
  async deleteUserRule(id) {
    await delay(220);
    userRules = userRules.filter((r) => r.id !== id);
    baselineRegras.delete(id);
    ultimoDisparoDiario.delete(id);
    return { ok: true };
  },
  async getUserTriggers() {
    await delayRead();
    return userTriggers.slice(0, 20).map((t) => ({ ...t, visto: vistosTriggers.has(t.id) }));
  },
  async marcarTriggersVistos() {
    await delay(120);
    vistosTriggers = new Set([...vistosTriggers, ...userTriggers.map((t) => t.id)]);
    return { ok: true };
  },
  /** RN-06 — agendador em memória: reavalia as regras ativas do usuário periodicamente,
   * separando renda variável (15 min) de cripto (5 min) via `classe`. Dispara apenas na
   * transição de não-atendida para atendida (RN-11) e respeita a frequência (RN-13).
   * Retorna os disparos novos desta passada, para a UI decidir como notificar. */
  async reavaliarRegrasUsuario(classe) {
    const hoje = new Date().toISOString().slice(0, 10);
    const disparadas = [];
    for (const rule of userRules) {
      if (!rule.ativa) {
        baselineRegras.delete(rule.id);
        continue;
      }
      const ehCripto = byTicker(rule.ticker)?.tipo === 'CRIPTO';
      if (classe && (ehCripto ? classe !== 'CRIPTO' : classe !== 'RENDA_VARIAVEL')) continue;

      const atingidoAgora = evaluateRule(rule).atingido;
      const atingidoAntes = baselineRegras.has(rule.id) ? baselineRegras.get(rule.id) : atingidoAgora;
      baselineRegras.set(rule.id, atingidoAgora);

      if (!atingidoAntes && atingidoAgora) {
        if (rule.frequencia === 'DIARIA' && ultimoDisparoDiario.get(rule.id) === hoje) continue;
        disparadas.push(dispararGatilhoRegra(rule));
      }
    }
    return disparadas;
  },

  /* ----- IA (RF-13, RF-14, RF-15) ----- */
  /** RF-13/RF-14/RNF-02 — texto gerado deterministicamente a partir dos indicadores
   * reais do ativo (nunca fixture estática). UC-03 alternativo: com o toggle de
   * desenvolvedor "IA indisponível" ligado, simula falha do provedor. */
  async getAssetAnalysis(ticker) {
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
    await delay(400);
    if (useUiStore.getState().iaIndisponivel) {
      throw new Error('Serviço de análise por IA temporariamente indisponível.');
    }
    return { texto: await gerarResumoDiario(), disclaimer: DISCLAIMER, gerado_em: new Date().toISOString() };
  },
  /** RF-15/UC-06 — function calling simulado: um roteador por palavra-chave escolhe
   * uma das funções que consultam o estado real da carteira (nunca texto fixo) e a
   * resposta é composta a partir do retorno dela — grounding (RN-02). */
  async askAI(pergunta) {
    await delay(900);
    const intent = interpretarPergunta(pergunta);
    if (!intent) return { texto: CHAT_FALLBACK, ferramentas: [], disclaimer: DISCLAIMER };
    const { texto, ferramentas } = await CHAT_FUNCTIONS[intent.fn](intent.args);
    return { texto, ferramentas, disclaimer: DISCLAIMER };
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

async function gerarResumoDiario() {
  const resumo = await api.getPortfolioSummary();
  const pos = await api.getPositions();
  const sinais24h = SIGNALS.filter(
    (s) => !s.data_desativacao && Date.now() - new Date(s.data_ativacao).getTime() <= 24 * 3_600_000,
  );
  const frases = [];

  frases.push(`A carteira apresenta variação do dia de ${fmtPct(resumo.variacao_dia_pct)}.`);

  const diffIbov = resumo.resultado_pct - resumo.benchmarks.ibovespa;
  const diffCdi = resumo.resultado_pct - resumo.benchmarks.cdi;
  frases.push(
    `No período acompanhado, o resultado acumulado é de ${fmtPct(resumo.resultado_pct)}, contra ${fmtPct(resumo.benchmarks.ibovespa)} ` +
      `do Ibovespa (${fmtPct(diffIbov)}) e ${fmtPct(resumo.benchmarks.cdi)} do CDI (${fmtPct(diffCdi)}).`,
  );

  if (pos.length > 0) {
    // Comparação em BRL — as posições em USD (cripto) precisam ser convertidas para
    // ficarem na mesma escala das posições em BRL antes de comparar contribuições.
    const resultadoBRL = (p) => p.valor_atual_brl - p.custo_brl;
    const maior = [...pos].sort((a, b) => Math.abs(resultadoBRL(b)) - Math.abs(resultadoBRL(a)))[0];
    const contribuicao = resultadoBRL(maior);
    const participacao = resumo.resultado !== 0 ? (contribuicao / resumo.resultado) * 100 : 0;
    frases.push(
      `${maior.ticker} responde pela maior contribuição individual ao resultado acumulado, com ${fmtBRL(contribuicao)} ` +
        `(${fmtNum(Math.abs(participacao), 0)}% do resultado total da carteira).`,
    );
  }

  frases.push(
    sinais24h.length > 0
      ? `${sinais24h.length} sinal(is) foram ativados nas últimas 24 horas: ${sinais24h.map((s) => `${s.ticker} (${ruleOf(s.regra_id).nome})`).join(', ')}.`
      : 'Nenhum sinal foi ativado nas últimas 24 horas.',
  );

  return frases.join(' ');
}

/* ----- function calling simulado do chat (RF-15) -----
 * Cada função abaixo consulta o estado real da carteira via `api.*` (as mesmas
 * funções usadas por Dashboard/Portfólio/Alertas) e compõe a resposta a partir
 * do retorno — os números nunca são inventados no texto. */

async function obterRentabilidadeCarteira() {
  const resumo = await api.getPortfolioSummary();
  return {
    ferramentas: ['obterRentabilidadeCarteira()'],
    texto:
      `O resultado não realizado da carteira é ${fmtBRL(resumo.resultado)} (${fmtPct(resumo.resultado_pct)}) ` +
      `sobre um custo total de ${fmtBRL(resumo.custo_total)}. O valor de mercado atual é ${fmtBRL(resumo.valor_total)}.`,
  };
}

async function obterExposicaoPorSetor() {
  const dist = await api.getDistribution();
  const classes = dist.classe.map((c) => `${fmtNum(c.pct, 1)}% ${c.nome}`).join(', ');
  const setores = dist.setor
    .slice(0, 3)
    .map((s) => `${s.nome} (${fmtNum(s.pct, 1)}%)`)
    .join(', ');
  return {
    ferramentas: ['obterExposicaoPorSetor()'],
    texto: `Por classe de ativo, a carteira está em ${classes}. Os setores com maior concentração são ${setores}.`,
  };
}

async function compararComBenchmark() {
  const resumo = await api.getPortfolioSummary();
  const diffIbov = resumo.resultado_pct - resumo.benchmarks.ibovespa;
  const diffCdi = resumo.resultado_pct - resumo.benchmarks.cdi;
  return {
    ferramentas: ['compararComBenchmark(benchmark=IBOV)', 'compararComBenchmark(benchmark=CDI)'],
    texto:
      `Desde o início da série acompanhada, a carteira acumula ${fmtPct(resumo.resultado_pct)} contra ` +
      `${fmtPct(resumo.benchmarks.ibovespa)} do Ibovespa e ${fmtPct(resumo.benchmarks.cdi)} do CDI — ` +
      `diferença de ${fmtPct(diffIbov)} em relação ao Ibovespa e ${fmtPct(diffCdi)} em relação ao CDI.`,
  };
}

async function listarSinaisAtivos() {
  const sinais = await api.getSignals({ apenasAtivos: true });
  if (sinais.length === 0) {
    return { ferramentas: ['listarSinaisAtivos()'], texto: 'Não há sinais ativos no momento entre os ativos monitorados.' };
  }
  const recentes = sinais
    .slice(0, 3)
    .map((s) => `${s.ticker} — ${s.regra.nome} (há ${Math.max(1, Math.round((Date.now() - new Date(s.data_ativacao).getTime()) / 3_600_000))} h)`)
    .join('; ');
  return {
    ferramentas: ['listarSinaisAtivos()'],
    texto: `Há ${sinais.length} sinal(is) ativo(s). Os mais recentes: ${recentes}. Cada um traz o histórico de ocorrências dos últimos 24 meses na tela do ativo.`,
  };
}

async function obterAtivoMaisRentavel({ pior = false } = {}) {
  const pos = await api.getPositions();
  if (pos.length === 0) {
    return { ferramentas: ['obterAtivoMaisRentavel()'], texto: 'Não há posições na carteira para calcular rentabilidade.' };
  }
  const ordenado = [...pos].sort((a, b) => (pior ? a.resultado_pct - b.resultado_pct : b.resultado_pct - a.resultado_pct));
  const top = ordenado[0];
  const proximos = ordenado
    .slice(1, 3)
    .map((p) => `${p.ticker} (${fmtPct(p.resultado_pct)})`)
    .join(', ');
  const rotulo = pior ? 'menor retorno percentual' : 'maior retorno percentual';
  return {
    ferramentas: ['obterAtivoMaisRentavel()'],
    texto:
      `A posição com ${rotulo} sobre o preço médio é ${top.ticker}, em ${fmtPct(top.resultado_pct)} ` +
      `(${fmtBRL(top.resultado, top.moeda)} sobre preço médio de ${fmtBRL(top.preco_medio, top.moeda)}).` +
      (proximos ? ` Em seguida: ${proximos}.` : ''),
  };
}

async function listarOperacoes({ tipo, ticker } = {}) {
  let ops = await api.getOperations();
  if (tipo) ops = ops.filter((o) => o.tipo === tipo);
  if (ticker) ops = ops.filter((o) => o.ticker === ticker);
  if (ops.length === 0) {
    return { ferramentas: ['listarOperacoes()'], texto: 'Nenhuma operação encontrada para esse filtro.' };
  }
  const compras = ops.filter((o) => o.tipo === 'COMPRA').length;
  const vendas = ops.filter((o) => o.tipo === 'VENDA').length;
  const recentes = ops
    .slice(0, 3)
    .map((o) => `${o.tipo === 'COMPRA' ? 'compra' : 'venda'} de ${o.quantidade} ${o.ticker} a ${fmtBRL(o.preco_unitario, byTicker(o.ticker)?.moeda)} em ${fmtDate(o.data)}`)
    .join('; ');
  const filtroLabel = [ticker, tipo ? (tipo === 'COMPRA' ? 'compras' : 'vendas') : null].filter(Boolean).join(' — ');
  return {
    ferramentas: [`listarOperacoes(${filtroLabel || 'todas'})`],
    texto: `${ops.length} operação(ões) registrada(s)${filtroLabel ? ` (filtro: ${filtroLabel})` : ''}: ${compras} compra(s) e ${vendas} venda(s). As mais recentes: ${recentes}.`,
  };
}

const CHAT_FUNCTIONS = {
  obterRentabilidadeCarteira,
  obterExposicaoPorSetor,
  compararComBenchmark,
  listarSinaisAtivos,
  obterAtivoMaisRentavel,
  listarOperacoes,
};

/** Roteador de intenção por palavra-chave (sem LLM) — escolhe a função e extrai
 * os argumentos simples (ticker/tipo) reconhecíveis na pergunta. */
function interpretarPergunta(pergunta) {
  const p = pergunta.toLowerCase();
  const tickerDetectado = ASSETS.find((a) => p.includes(a.ticker.toLowerCase()))?.ticker;

  if (/pior|prejuízo|prejuizo|queda|perdeu|caiu mais/.test(p)) return { fn: 'obterAtivoMaisRentavel', args: { pior: true } };
  if (/rentáv|rentav|melhor ativo|mais subiu|maior alta|maior retorno/.test(p)) return { fn: 'obterAtivoMaisRentavel', args: {} };
  if (/exposiç|exposic|distribuiç|distribuic|concentr|\bsetor\b/.test(p)) return { fn: 'obterExposicaoPorSetor', args: {} };
  if (/\bcdi\b|ibovespa|\bibov\b|benchmark|compar/.test(p)) return { fn: 'compararComBenchmark', args: {} };
  if (/venda|vendi/.test(p)) return { fn: 'listarOperacoes', args: { tipo: 'VENDA', ticker: tickerDetectado } };
  if (/compra|comprei/.test(p)) return { fn: 'listarOperacoes', args: { tipo: 'COMPRA', ticker: tickerDetectado } };
  if (/operaç|operac|histórico|historico/.test(p)) return { fn: 'listarOperacoes', args: { ticker: tickerDetectado } };
  if (/sinal|sinais|alerta/.test(p)) return { fn: 'listarSinaisAtivos', args: {} };
  if (/rentabilidade|resultado da carteira|rendeu|lucro|ganho|patrimôni|patrimoni/.test(p)) return { fn: 'obterRentabilidadeCarteira', args: {} };
  return null;
}

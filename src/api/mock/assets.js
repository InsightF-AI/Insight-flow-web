/** Universo de ativos mockado — B3 (ações, FII, ETF) + criptomoedas.
 * `fundamentos` segue o recorte clássico de fichas como a do investidor10
 * (P/L, P/VP, DY, ROE) — nulo onde o indicador não se aplica ao tipo de ativo. */
export const ASSETS = [
  { id: 'a1', ticker: 'PETR4', nome: 'Petróleo Brasileiro S.A.', tipo: 'ACAO', setor: 'Petróleo e Gás', moeda: 'BRL', fonte: 'brapi', base: 38.42, vol: 0.019, fundamentos: { pl: 4.6, pvp: 1.3, dy: 12.8, roe: 28.4 } },
  { id: 'a2', ticker: 'VALE3', nome: 'Vale S.A.', tipo: 'ACAO', setor: 'Mineração', moeda: 'BRL', fonte: 'brapi', base: 61.15, vol: 0.017, fundamentos: { pl: 5.9, pvp: 1.6, dy: 9.4, roe: 22.1 } },
  { id: 'a3', ticker: 'ITUB4', nome: 'Itaú Unibanco Holding', tipo: 'ACAO', setor: 'Financeiro', moeda: 'BRL', fonte: 'brapi', base: 34.9, vol: 0.013, fundamentos: { pl: 8.2, pvp: 1.8, dy: 6.5, roe: 20.3 } },
  { id: 'a4', ticker: 'BBAS3', nome: 'Banco do Brasil S.A.', tipo: 'ACAO', setor: 'Financeiro', moeda: 'BRL', fonte: 'brapi', base: 27.31, vol: 0.015, fundamentos: { pl: 4.1, pvp: 0.9, dy: 10.2, roe: 19.8 } },
  { id: 'a5', ticker: 'WEGE3', nome: 'WEG S.A.', tipo: 'ACAO', setor: 'Bens Industriais', moeda: 'BRL', fonte: 'brapi', base: 52.8, vol: 0.016, fundamentos: { pl: 28.5, pvp: 7.8, dy: 1.4, roe: 27.6 } },
  { id: 'a6', ticker: 'MGLU3', nome: 'Magazine Luiza S.A.', tipo: 'ACAO', setor: 'Varejo', moeda: 'BRL', fonte: 'brapi', base: 9.74, vol: 0.032, fundamentos: { pl: null, pvp: 2.1, dy: 0, roe: -8.3 } },
  { id: 'a7', ticker: 'BOVA11', nome: 'iShares Ibovespa ETF', tipo: 'ETF', setor: 'Índice', moeda: 'BRL', fonte: 'brapi', base: 128.6, vol: 0.012, fundamentos: null },
  { id: 'a8', ticker: 'HGLG11', nome: 'CSHG Logística FII', tipo: 'FII', setor: 'Logística', moeda: 'BRL', fonte: 'brapi', base: 163.2, vol: 0.008, fundamentos: { pl: null, pvp: 1.05, dy: 8.9, roe: null } },
  { id: 'a9', ticker: 'BTC', nome: 'Bitcoin', tipo: 'CRIPTO', setor: '—', moeda: 'USD', fonte: 'binance', base: 68120, vol: 0.028, fundamentos: null },
  { id: 'a10', ticker: 'ETH', nome: 'Ethereum', tipo: 'CRIPTO', setor: '—', moeda: 'USD', fonte: 'binance', base: 3285, vol: 0.034, fundamentos: null },
  { id: 'a11', ticker: 'SOL', nome: 'Solana', tipo: 'CRIPTO', setor: '—', moeda: 'USD', fonte: 'binance', base: 172.4, vol: 0.045, fundamentos: null },
];

/** Câmbio mockado usado para consolidar posições em USD nos agregados em BRL. */
export const USD_BRL = 5.4;
export const toBRL = (valor, moeda) => (moeda === 'USD' ? valor * USD_BRL : valor);

export const byTicker = (t) => ASSETS.find((a) => a.ticker === t.toUpperCase());

/** PRNG determinístico — a mesma série é gerada em toda sessão. */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (ticker) => ticker.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 7);

/** Série OHLCV diária sintética (RF-05). */
export function generateCandles(ticker, days = 420) {
  const asset = byTicker(ticker);
  if (!asset) return [];
  const rnd = mulberry32(seedOf(ticker));
  const out = [];
  let price = asset.base * 0.72;
  const cripto = asset.tipo === 'CRIPTO';
  const start = new Date();
  start.setDate(start.getDate() - days);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dow = d.getDay();
    if (!cripto && (dow === 0 || dow === 6)) continue;
    const drift = 0.0006 + Math.sin(i / 47) * 0.0011;
    const shock = (rnd() - 0.5) * asset.vol * 2.1;
    const open = price;
    const close = Math.max(0.5, open * (1 + drift + shock));
    const wick = Math.abs(shock) * open * 0.9 + open * 0.002;
    out.push({
      time: d.toISOString().slice(0, 10),
      open: +open.toFixed(2),
      high: +(Math.max(open, close) + wick * rnd()).toFixed(2),
      low: +(Math.min(open, close) - wick * rnd()).toFixed(2),
      close: +close.toFixed(2),
      volume: Math.round((0.7 + rnd() * 0.9) * (cripto ? 900_000 : 24_000_000)),
    });
    price = close;
  }
  // Normaliza a série para que o último fechamento seja o preço declarado em `base`,
  // mantendo a forma da caminhada aleatória (busca, cotação e posições ficam coerentes).
  const k = asset.base / out[out.length - 1].close;
  return out.map((c) => ({
    ...c,
    open: +(c.open * k).toFixed(2),
    high: +(c.high * k).toFixed(2),
    low: +(c.low * k).toFixed(2),
    close: +(c.close * k).toFixed(2),
  }));
}

export const PERIODS = [
  { id: '1d', label: '1D', candles: 1 },
  { id: '1s', label: '1S', candles: 5 },
  { id: '1m', label: '1M', candles: 22 },
  { id: '3m', label: '3M', candles: 66 },
  { id: '1a', label: '1A', candles: 252 },
  { id: '5a', label: '5A', candles: 420 },
];

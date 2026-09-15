/** Carteira fictícia (RF-10 a RF-12, RN-04). */
export const OPERATIONS = [
  { id: 'o1', ticker: 'PETR4', tipo: 'COMPRA', quantidade: 300, preco_unitario: 32.1, data: '2026-02-11' },
  { id: 'o2', ticker: 'VALE3', tipo: 'COMPRA', quantidade: 150, preco_unitario: 58.4, data: '2026-03-04' },
  { id: 'o3', ticker: 'ITUB4', tipo: 'COMPRA', quantidade: 400, preco_unitario: 30.75, data: '2026-03-19' },
  { id: 'o4', ticker: 'PETR4', tipo: 'VENDA', quantidade: 100, preco_unitario: 36.8, data: '2026-05-22' },
  { id: 'o5', ticker: 'BOVA11', tipo: 'COMPRA', quantidade: 60, preco_unitario: 121.4, data: '2026-04-08' },
  { id: 'o6', ticker: 'HGLG11', tipo: 'COMPRA', quantidade: 40, preco_unitario: 158.9, data: '2026-04-25' },
  { id: 'o7', ticker: 'BTC', tipo: 'COMPRA', quantidade: 0.12, preco_unitario: 61200, data: '2026-05-02' },
  { id: 'o8', ticker: 'ETH', tipo: 'COMPRA', quantidade: 1.4, preco_unitario: 2980, data: '2026-06-14' },
  { id: 'o9', ticker: 'WEGE3', tipo: 'COMPRA', quantidade: 120, preco_unitario: 49.2, data: '2026-07-01' },
  { id: 'o10', ticker: 'SOL', tipo: 'COMPRA', quantidade: 30, preco_unitario: 150.2, data: '2026-07-20' },
];

/** Evolução da carteira vs. benchmarks (RF-11) — base 100. */
export const EQUITY_CURVE = (() => {
  const out = [];
  let carteira = 100;
  let ibov = 100;
  let cdi = 100;
  const start = new Date('2026-02-03');
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);
    carteira *= 1 + (Math.sin(i / 3.1) * 0.011 + 0.0072);
    ibov *= 1 + (Math.sin(i / 2.4) * 0.013 + 0.0039);
    cdi *= 1.0021;
    out.push({
      data: d.toISOString().slice(0, 10),
      carteira: +carteira.toFixed(2),
      ibovespa: +ibov.toFixed(2),
      cdi: +cdi.toFixed(2),
    });
  }
  return out;
})();

export const WATCHLIST = [
  { ticker: 'PETR4', notificar: true, adicionado_em: '2026-02-10' },
  { ticker: 'VALE3', notificar: true, adicionado_em: '2026-02-10' },
  { ticker: 'ITUB4', notificar: true, adicionado_em: '2026-03-18' },
  { ticker: 'BTC', notificar: true, adicionado_em: '2026-05-01' },
  { ticker: 'ETH', notificar: false, adicionado_em: '2026-06-13' },
  { ticker: 'MGLU3', notificar: true, adicionado_em: '2026-07-20' },
  { ticker: 'WEGE3', notificar: true, adicionado_em: '2026-06-30' },
];

/** Regras de sinal (RegraSinal), sinais ativos e backtest — RF-07, RF-08, RN-03. */
export const RULES = [
  { id: 'r1', nome: 'Sobrevenda RSI', descricao: 'RSI(14) abaixo de 30 com volume relativo acima de 1,2.', peso: 0.28, tom: 'blue' },
  { id: 'r2', nome: 'Sobrecompra RSI', descricao: 'RSI(14) acima de 70 por dois pregões consecutivos.', peso: 0.22, tom: 'orange' },
  { id: 'r3', nome: 'Cruzamento SMA 20/50', descricao: 'Média de 20 períodos cruza acima da média de 50 períodos.', peso: 0.3, tom: 'green' },
  { id: 'r4', nome: 'Rompimento banda superior', descricao: 'Fechamento acima da banda superior de Bollinger (20, 2).', peso: 0.18, tom: 'purple' },
  { id: 'r5', nome: 'MACD cruzando linha de sinal', descricao: 'Histograma MACD (12, 26, 9) muda de sinal negativo para positivo.', peso: 0.26, tom: 'blue' },
  { id: 'r6', nome: 'Volume atípico', descricao: 'Volume relativo acima de 2,0 em relação à média de 20 períodos.', peso: 0.14, tom: 'yellow' },
];

const h = (n) => new Date(Date.now() - n * 3600_000).toISOString();

export const SIGNALS = [
  { id: 's1', ticker: 'PETR4', regra_id: 'r1', data_ativacao: h(3), data_desativacao: null, contexto: { 'RSI(14)': 28.4, 'Vol. relativo': 1.42, 'Fech.': 38.42 } },
  { id: 's2', ticker: 'VALE3', regra_id: 'r3', data_ativacao: h(9), data_desativacao: null, contexto: { 'SMA(20)': 60.12, 'SMA(50)': 59.87, 'Fech.': 61.15 } },
  { id: 's3', ticker: 'BTC', regra_id: 'r4', data_ativacao: h(1), data_desativacao: null, contexto: { 'Banda sup.': 67240, 'Fech.': 68120, 'Vol. relativo': 1.31 } },
  { id: 's4', ticker: 'MGLU3', regra_id: 'r6', data_ativacao: h(6), data_desativacao: null, contexto: { 'Vol. relativo': 2.38, 'Fech.': 9.74 } },
  { id: 's5', ticker: 'ITUB4', regra_id: 'r5', data_ativacao: h(20), data_desativacao: null, contexto: { 'MACD': 0.21, 'Sinal': 0.14, 'Hist.': 0.07 } },
  { id: 's6', ticker: 'ETH', regra_id: 'r2', data_ativacao: h(31), data_desativacao: null, contexto: { 'RSI(14)': 72.6, 'Fech.': 3285 } },
  { id: 's7', ticker: 'SOL', regra_id: 'r3', data_ativacao: h(52), data_desativacao: h(4), contexto: { 'SMA(20)': 168.9, 'SMA(50)': 170.2 } },
  { id: 's8', ticker: 'WEGE3', regra_id: 'r1', data_ativacao: h(76), data_desativacao: h(40), contexto: { 'RSI(14)': 29.1, 'Vol. relativo': 1.22 } },
];

/** Ocorrências anteriores da mesma condição nos últimos 24 meses. */
export const BACKTESTS = {
  r1: { ocorrencias: 14, ret5: 1.8, ret20: 4.2, ret60: 6.1, acerto: 64 },
  r2: { ocorrencias: 11, ret5: -0.9, ret20: -1.6, ret60: 2.4, acerto: 45 },
  r3: { ocorrencias: 9, ret5: 2.4, ret20: 5.7, ret60: 9.3, acerto: 71 },
  r4: { ocorrencias: 18, ret5: 0.6, ret20: -0.4, ret60: 3.1, acerto: 52 },
  r5: { ocorrencias: 12, ret5: 1.2, ret20: 3.4, ret60: 5.2, acerto: 61 },
  r6: { ocorrencias: 22, ret5: 0.4, ret20: 1.1, ret60: 2.2, acerto: 49 },
};

export const ruleOf = (id) => RULES.find((r) => r.id === id);

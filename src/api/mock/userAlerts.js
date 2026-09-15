/** Alertas definidos pelo usuário (extensão do RF-07/RF-09 para regras pessoais). */

export const METRICAS = [
  { id: 'PRECO', label: 'Preço', unidade: 'moeda', dica: 'Último fechamento do ativo' },
  { id: 'VAR_DIA', label: 'Variação do dia', unidade: '%', dica: 'Variação percentual sobre o fechamento anterior' },
  { id: 'RSI', label: 'RSI (14)', unidade: '', dica: 'Índice de força relativa de 14 períodos' },
  { id: 'DIST_SMA20', label: 'Distância da SMA 20', unidade: '%', dica: 'Quanto o preço está acima ou abaixo da média de 20 períodos' },
  { id: 'VOL_REL', label: 'Volume relativo', unidade: '×', dica: 'Volume sobre a média de 20 períodos' },
];

export const OPERADORES = [
  { id: 'GTE', label: 'atingir ou superar', simbolo: '≥' },
  { id: 'LTE', label: 'cair para ou abaixo de', simbolo: '≤' },
];

export const CANAIS = [
  { id: 'PUSH', label: 'Web push' },
  { id: 'EMAIL', label: 'E-mail' },
  { id: 'MOBILE', label: 'Notificação mobile' },
  { id: 'DESKTOP', label: 'Bandeja do Windows' },
];

export const FREQUENCIAS = [
  { id: 'UMA_VEZ', label: 'Uma vez e desativar' },
  { id: 'SEMPRE', label: 'A cada reavaliação' },
  { id: 'DIARIA', label: 'No máximo uma vez por dia' },
];

export const metricaOf = (id) => METRICAS.find((m) => m.id === id);
export const operadorOf = (id) => OPERADORES.find((o) => o.id === id);

const h = (n) => new Date(Date.now() - n * 3600_000).toISOString();

export const USER_RULES = [
  { id: 'ua1', ticker: 'BTC', metrica: 'PRECO', operador: 'GTE', valor: 70000, canais: ['PUSH', 'EMAIL'], frequencia: 'UMA_VEZ', nota: 'Alvo de realização parcial', ativa: true, criada_em: h(72) },
  { id: 'ua2', ticker: 'PETR4', metrica: 'PRECO', operador: 'LTE', valor: 36, canais: ['PUSH', 'MOBILE'], frequencia: 'DIARIA', nota: 'Zona de recompra', ativa: true, criada_em: h(48) },
  { id: 'ua3', ticker: 'MGLU3', metrica: 'RSI', operador: 'LTE', valor: 30, canais: ['PUSH'], frequencia: 'SEMPRE', nota: '', ativa: true, criada_em: h(26) },
  { id: 'ua4', ticker: 'VALE3', metrica: 'VAR_DIA', operador: 'GTE', valor: 3, canais: ['PUSH', 'DESKTOP'], frequencia: 'DIARIA', nota: 'Movimento atípico no dia', ativa: true, criada_em: h(12) },
  { id: 'ua5', ticker: 'ETH', metrica: 'RSI', operador: 'GTE', valor: 70, canais: ['EMAIL'], frequencia: 'UMA_VEZ', nota: '', ativa: false, criada_em: h(96) },
];

export const USER_TRIGGERS = [
  { id: 't1', regra_id: 'ua3', ticker: 'MGLU3', texto: 'RSI (14) caiu para 29,4 — condição ≤ 30 satisfeita.', canais: ['PUSH'], data: h(5) },
  { id: 't2', regra_id: 'ua4', ticker: 'VALE3', texto: 'Variação do dia atingiu +3,20% — condição ≥ 3% satisfeita.', canais: ['PUSH', 'DESKTOP'], data: h(29) },
  { id: 't3', regra_id: 'ua2', ticker: 'PETR4', texto: 'Preço caiu para R$ 35,80 — condição ≤ R$ 36,00 satisfeita.', canais: ['PUSH', 'MOBILE'], data: h(53) },
];

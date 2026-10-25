/** Operadores dos alertas de preço do usuário (a API só suporta preço ≥ / ≤). */
export const OPERADORES = [
  { id: 'GTE', label: 'atingir ou superar', simbolo: '≥' },
  { id: 'LTE', label: 'cair para ou abaixo de', simbolo: '≤' },
];

export const operadorOf = (id) => OPERADORES.find((o) => o.id === id);

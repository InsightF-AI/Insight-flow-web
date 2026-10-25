// a brapi no plano gratuito só entrega histórico de 1M e 3M — os demais períodos falham no backend.
export const PERIODS = [
  { id: '1m', label: '1M', candles: 22 },
  { id: '3m', label: '3M', candles: 66 },
];

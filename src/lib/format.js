export const fmtBRL = (v, moeda = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(v ?? 0);

export const fmtNum = (v, d = 2) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v ?? 0);

export const fmtPct = (v, d = 2) => `${v > 0 ? '+' : ''}${fmtNum(v, d)}%`;

export const fmtCompact = (v) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v ?? 0);

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const sinceNow = (iso) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
};

export const trendClass = (v) => (v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-fg-2');

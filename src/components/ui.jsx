import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';

export function Card({ title, action, children, className = '', bodyClass = 'p-4', interactive = false }) {
  return (
    <section className={`card ${interactive ? 'card--interactive' : ''} ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-t-xl border-b border-border-soft bg-elevated px-4 py-3">
          <h3 className="text-sm font-semibold text-fg-1">{title}</h3>
          {action}
        </header>
      )}
      <div className={`min-w-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

const TONES = {
  green: 'bg-tone-green-bg text-up',
  red: 'bg-tone-red-bg text-down',
  yellow: 'bg-tone-yellow-bg text-warn',
  orange: 'bg-tone-orange-bg text-tone-orange-fg',
  blue: 'bg-tone-blue-bg text-accent',
  purple: 'bg-tone-violet-bg text-purple',
  slate: 'bg-muted text-fg-2',
};

export function Pill({ tone = 'slate', children, className = '' }) {
  return <span className={`pill ${TONES[tone] ?? TONES.slate} ${className}`}>{children}</span>;
}

const ICON_TONES = {
  accent: 'bg-accent text-white',
  up: 'bg-up text-[#06251a]',
  down: 'bg-down text-white',
  amber: 'bg-brand text-[#2b1c00]',
  purple: 'bg-purple text-white',
  slate: 'bg-muted text-fg-1',
};

/** Ícone em chip colorido — cabeçalho de KPI/seção (padrão de referência).
 * `live` acrescenta um ping sutil no canto (monitoramento em tempo real). */
export function IconChip({ icon: Icon, tone = 'accent', size = 34, live = false }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className={`icon-chip grid h-full w-full place-items-center ${ICON_TONES[tone] ?? ICON_TONES.accent}`}
      >
        <Icon size={Math.round(size * 0.46)} />
      </span>
      {live && <span className="signal-ping absolute -right-0.5 -top-0.5" />}
    </span>
  );
}

/** Ícone pequeno + rótulo — para títulos de Card (seção). */
export function SectionTitle({ icon: Icon, tone = 'accent', children }) {
  return (
    <span className="flex items-center gap-2">
      <IconChip icon={Icon} tone={tone} size={24} />
      {children}
    </span>
  );
}

export function Kpi({ label, value, hint, tone, icon, iconTone = 'accent', live = false }) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-fg-3 sm:text-xs">{label}</div>
        {icon && <IconChip icon={icon} tone={iconTone} size={28} live={live} />}
      </div>
      <div className={`num mt-1.5 truncate text-lg font-bold sm:mt-2 sm:text-2xl ${tone ?? 'text-fg-0'}`}>{value}</div>
      {hint && <div className="mt-1 truncate text-[11px] text-fg-2 sm:text-xs">{hint}</div>}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`animate-pulse rounded-sm bg-muted ${className}`} />;
}

export function Empty({ children, action }) {
  return (
    <div className="grid place-items-center gap-2 py-10 text-center text-sm text-fg-3">
      <Inbox size={22} className="text-fg-3 opacity-60" />
      {children}
      {action}
    </div>
  );
}

/** RNF-10 — estado de erro de carregamento, no mesmo estilo visual do `Empty`,
 * com ação de nova tentativa (religa a query via `refetch`). */
export function ErrorState({ message = 'Não foi possível carregar os dados.', onRetry }) {
  return (
    <div className="grid place-items-center gap-2 py-10 text-center text-sm text-fg-3">
      <AlertCircle size={22} className="text-down opacity-80" />
      <p>{message}</p>
      {onRetry && (
        <button onClick={() => onRetry()} className="btn-ghost mt-1 px-3 py-1.5 text-xs">
          <RefreshCw size={13} /> Tentar novamente
        </button>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useToastStore } from '../store/toastStore.js';

/** RF-18/UC-07 — notificações in-app: toast transitório para cada disparo de regra,
 * independente da tela em que o usuário estiver ("central" no sentido de global). */
export default function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] grid w-[min(360px,calc(100vw-2rem))] gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-in flex items-start gap-2.5 rounded-xl border border-border-main bg-surface px-4 py-3 shadow-lg"
        >
          <span className="signal-ping mt-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-fg-0">
              <Bell size={14} className="text-accent shrink-0" />
              <span className="truncate">{t.titulo}</span>
            </div>
            <p className="mt-1 text-xs text-fg-2">{t.texto}</p>
            {t.link && (
              <Link
                to={t.link}
                onClick={() => dismiss(t.id)}
                className="mt-1.5 inline-block text-xs font-semibold text-accent"
              >
                Ver detalhe →
              </Link>
            )}
          </div>
          <button onClick={() => dismiss(t.id)} className="shrink-0 text-fg-3 hover:text-fg-1">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

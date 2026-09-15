import { useEffect } from 'react';
import { X, Settings as SettingsIcon } from 'lucide-react';
import { useUiStore } from '../store/index.js';
import SettingsPanel from './SettingsPanel.jsx';
import { SectionTitle } from './ui.jsx';

/** Configurações como modal (igual ao padrão do Claude): fundo desfocado,
 * abre por cima da tela atual, fecha sem perder o lugar onde você estava. */
export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useUiStore();

  useEffect(() => {
    if (!settingsOpen) return;
    const onEsc = (e) => e.key === 'Escape' && setSettingsOpen(false);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="fade-in flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border-main bg-surface shadow-lg sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 rounded-t-2xl border-b border-border-soft bg-elevated px-5 py-3.5">
          <h2 className="text-sm font-semibold text-fg-1">
            <SectionTitle icon={SettingsIcon}>Configurações</SectionTitle>
          </h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="rounded-sm p-1.5 text-fg-3 hover:bg-muted hover:text-fg-1"
            aria-label="Fechar configurações"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <SettingsPanel />
        </div>
      </div>
    </div>
  );
}

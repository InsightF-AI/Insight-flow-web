import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useUiStore } from '../store/index.js';
import { useSearch } from '../hooks/queries.js';
import { Pill } from './ui.jsx';

export default function SearchDialog() {
  const { searchOpen, setSearchOpen } = useUiStore();
  const [termo, setTermo] = useState('');
  const { data, isFetching } = useSearch(termo);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen]);

  if (!searchOpen) return null;

  const go = (ticker) => {
    setSearchOpen(false);
    setTermo('');
    navigate(`/ativo/${ticker}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-24" onClick={() => setSearchOpen(false)}>
      <div className="fade-in w-full max-w-xl overflow-hidden rounded-xl border border-border-main bg-surface shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border-soft px-4 py-3">
          <Search size={16} className="text-fg-3" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="PETR4, Vale, Bitcoin…"
            className="flex-1 bg-transparent text-sm text-fg-0 placeholder:text-fg-3 focus:outline-none"
          />
          <button onClick={() => setSearchOpen(false)} className="text-fg-3 hover:text-fg-1">
            <X size={16} />
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {(data ?? []).map((a) => (
            <li key={a.id}>
              <button onClick={() => go(a.ticker)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-elevated">
                <span className="num w-16 text-sm font-bold text-fg-0">{a.ticker}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-fg-2">{a.nome}</span>
                <Pill tone={a.tipo === 'CRIPTO' ? 'purple' : 'blue'}>{a.tipo}</Pill>
              </button>
            </li>
          ))}
          {!isFetching && (data ?? []).length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-fg-3">Nenhum ativo encontrado para “{termo}”.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

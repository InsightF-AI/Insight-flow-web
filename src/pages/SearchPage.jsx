import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus, Search } from 'lucide-react';
import { useSearch, useWatchlist, useWatchlistMutations } from '../hooks/queries.js';
import { Card, Pill, Skeleton, Empty, ErrorState } from '../components/ui.jsx';
import { fmtNum } from '../lib/format.js';

const TIPOS = ['TODOS', 'ACAO', 'FII', 'ETF', 'CRIPTO'];
const MAIS_BUSCADOS = ['PETR4', 'VALE3', 'ITUB4', 'BTC', 'WEGE3'];

/** UC-02 — buscar ativo e adicionar à watchlist. */
export default function SearchPage() {
  const [termo, setTermo] = useState('');
  const [tipo, setTipo] = useState('TODOS');
  const { data, isFetching, isError, refetch } = useSearch(termo);
  const { data: watchlist } = useWatchlist();
  const { add, remove } = useWatchlistMutations();

  const lista = (data ?? []).filter((a) => tipo === 'TODOS' || a.tipo === tipo);
  const naWatchlist = (t) => (watchlist ?? []).some((w) => w.ticker === t);

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header>
        <h2 className="text-2xl font-bold">Buscar ativos</h2>
        <p className="mt-1">Ações, FIIs e ETFs da B3 e criptomoedas. Ao adicionar, a notificação vem habilitada.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-fg-3">Mais buscados:</span>
        {MAIS_BUSCADOS.map((t) => (
          <button
            key={t}
            onClick={() => setTermo(t)}
            className="num rounded-full border border-border-main px-2.5 py-1 font-semibold text-fg-2 hover:border-accent hover:text-fg-0"
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            className="input pl-9"
            placeholder="Ticker ou nome do ativo"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-0.5 rounded-sm bg-elevated p-0.5">
          {TIPOS.map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold ${
                tipo === t ? 'bg-muted text-fg-0 shadow-sm' : 'text-fg-3 hover:text-fg-1'
              }`}
            >
              {t === 'TODOS' ? 'Todos' : t}
            </button>
          ))}
        </div>
      </div>

      <Card bodyClass="p-0">
        {isFetching && !data ? (
          <div className="grid gap-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : lista.length === 0 ? (
          <Empty
            action={
              <button
                onClick={() => {
                  setTermo('');
                  setTipo('TODOS');
                }}
                className="btn-ghost px-3 py-1.5 text-xs"
              >
                Limpar busca
              </button>
            }
          >
            Nenhum ativo corresponde à busca.
          </Empty>
        ) : (
          <ul>
            {lista.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0 hover:bg-elevated">
                <Link to={`/ativo/${a.ticker}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="num text-sm font-bold text-fg-0">{a.ticker}</span>
                    <Pill tone={a.tipo === 'CRIPTO' ? 'purple' : 'blue'}>{a.tipo}</Pill>
                  </div>
                  <div className="truncate text-xs text-fg-2">
                    {a.nome} · {a.setor} · {a.moeda}
                  </div>
                </Link>
                <span className="num hidden text-sm text-fg-2 sm:block">{fmtNum(a.base)}</span>
                <button
                  onClick={() => (naWatchlist(a.ticker) ? remove.mutate(a.ticker) : add.mutate(a.ticker))}
                  className={naWatchlist(a.ticker) ? 'btn-ghost' : 'btn-primary'}
                >
                  {naWatchlist(a.ticker) ? (
                    <>
                      <Check size={14} /> Na watchlist
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Adicionar
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

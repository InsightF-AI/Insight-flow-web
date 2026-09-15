import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Bell, CheckCheck, Search } from 'lucide-react';
import { useAlerts, useMarkAlertRead, useMarkAllAlertsRead } from '../hooks/queries.js';
import { Card, Pill, Skeleton, Empty, ErrorState, SectionTitle } from '../components/ui.jsx';
import { fmtNum, fmtPct, fmtDateTime, sinceNow } from '../lib/format.js';

const FILTROS = [
  { id: 'ativos', label: 'Ativos' },
  { id: 'todos', label: 'Todos' },
  { id: 'nao_lidos', label: 'Não lidos' },
];

/** UC-05 — alertas de sinal técnico com contexto histórico (RN-03). */
export default function Alerts() {
  const [filtro, setFiltro] = useState('ativos');
  const [busca, setBusca] = useState('');
  const { data, isLoading, isError, refetch } = useAlerts();
  const marcar = useMarkAlertRead();
  const marcarTodos = useMarkAllAlertsRead();

  const naoLidos = (data ?? []).filter((a) => !a.lido).length;
  const termo = busca.trim().toUpperCase();
  const lista = (data ?? []).filter(
    (a) =>
      (filtro === 'ativos' ? a.ativo : filtro === 'nao_lidos' ? !a.lido : true) &&
      (!termo || a.ticker.includes(termo)),
  );

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            Alertas
            {naoLidos > 0 && <Pill tone="blue">{naoLidos} não lidos</Pill>}
          </h2>
          <p className="mt-1">Entrega por web push, notificação mobile e bandeja do Windows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {naoLidos > 0 && (
            <button
              onClick={() => marcarTodos.mutate()}
              disabled={marcarTodos.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent"
            >
              <CheckCheck size={14} /> Marcar todos como lidos
            </button>
          )}
          <div className="flex flex-wrap gap-0.5 rounded-sm bg-elevated p-0.5">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold ${
                  filtro === f.id ? 'bg-muted text-fg-0 shadow-sm' : 'text-fg-3 hover:text-fg-1'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
        <input
          className="input pl-9"
          placeholder="Filtrar por ticker…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Card title={<SectionTitle icon={Bell}>Sinais e disparos</SectionTitle>} bodyClass="p-0">
        {isLoading ? (
          <div className="grid gap-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : lista.length === 0 ? (
          <Empty>Nenhum alerta neste filtro.</Empty>
        ) : (
          <ul>
            {lista.map((a) => (
              <li key={a.id} className={`border-b border-border-soft p-4 last:border-0 ${a.lido ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  {!a.lido && <span className="signal-ping shrink-0" />}
                  <Link to={`/ativo/${a.ticker}`} className="num text-sm font-bold">
                    {a.ticker}
                  </Link>
                  <Pill tone={a.ativo ? a.regra.tom : 'slate'}>{a.regra.nome}</Pill>
                  {!a.ativo && <span className="text-xs text-fg-3">encerrado</span>}
                  <span className="ml-auto text-xs text-fg-3" title={fmtDateTime(a.data)}>
                    há {sinceNow(a.data)}
                  </span>
                </div>
                <p className="mt-2">{a.regra.descricao}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  {Object.entries(a.contexto).map(([k, v]) => (
                    <span key={k} className="text-xs text-fg-2">
                      {k} <span className="num font-semibold text-fg-0">{fmtNum(v)}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-fg-3">
                  <span>
                    {a.backtest.ocorrencias} ocorrências em 24 meses · retorno médio {fmtPct(a.backtest.ret5)} (5p),{' '}
                    {fmtPct(a.backtest.ret20)} (20p), {fmtPct(a.backtest.ret60)} (60p)
                  </span>
                  {!a.lido && (
                    <button onClick={() => marcar.mutate(a.id)} className="ml-auto font-semibold text-accent">
                      Marcar como lido
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

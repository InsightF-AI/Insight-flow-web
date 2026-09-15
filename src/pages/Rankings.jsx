import { Link } from 'react-router-dom';
import { Activity, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import { useRankings } from '../hooks/queries.js';
import { Card, Empty, ErrorState, Pill, SectionTitle, Skeleton } from '../components/ui.jsx';
import { fmtNum, fmtPct } from '../lib/format.js';

function RankingCard({ title, icon, tone, itens, isError, onRetry, render }) {
  return (
    <Card title={<SectionTitle icon={icon} tone={tone}>{title}</SectionTitle>} bodyClass="p-0">
      {isError ? (
        <ErrorState onRetry={onRetry} />
      ) : !itens ? (
        <div className="grid gap-3 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <Empty>Nada por aqui no momento.</Empty>
      ) : (
        <ul>
          {itens.map((it, i) => (
            <li key={it.ticker} className="border-b border-border-soft last:border-0">
              <Link to={`/ativo/${it.ticker}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated">
                <span className="num w-5 shrink-0 text-xs font-bold text-fg-3">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <span className="num text-sm font-bold text-fg-0">{it.ticker}</span>
                  <div className="truncate text-xs text-fg-3">{it.nome}</div>
                </div>
                {render(it)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Rankings de mercado — altas, baixas, volume relativo e sinais ativos,
 * inspirado nos rankings de ativos do investidor10. */
export default function Rankings() {
  const { data, isError, refetch } = useRankings();

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      <header>
        <h2 className="text-2xl font-bold">Rankings</h2>
        <p className="mt-1">Recorte do universo de ativos acompanhado pelo sistema, atualizado a cada consulta.</p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <RankingCard
          title="Maiores altas"
          icon={TrendingUp}
          tone="up"
          itens={data?.altas}
          isError={isError}
          onRetry={refetch}
          render={(it) => <span className="num text-sm font-semibold text-up">{fmtPct(it.variacao_pct)}</span>}
        />
        <RankingCard
          title="Maiores baixas"
          icon={TrendingDown}
          tone="down"
          itens={data?.baixas}
          isError={isError}
          onRetry={refetch}
          render={(it) => <span className="num text-sm font-semibold text-down">{fmtPct(it.variacao_pct)}</span>}
        />
        <RankingCard
          title="Maior volume relativo"
          icon={Activity}
          tone="purple"
          itens={data?.volume}
          isError={isError}
          onRetry={refetch}
          render={(it) => <span className="num text-sm font-semibold text-fg-0">{fmtNum(it.volRel, 2)}×</span>}
        />
        <RankingCard
          title="Mais sinais ativos"
          icon={Radar}
          tone="amber"
          itens={data?.sinais}
          isError={isError}
          onRetry={refetch}
          render={(it) => <Pill tone="blue">{it.sinais}</Pill>}
        />
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Activity, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import { useRankings } from '../hooks/queries.js';
import { Card, Empty, ErrorState, Pill, SectionTitle, Skeleton } from '../components/ui.jsx';
import { fmtNum, fmtPct } from '../lib/format.js';

function RankingCard({ title, icon, tone, itens, vazio, isError, onRetry, render }) {
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
        <Empty>{vazio}</Empty>
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

/** Rankings dos ativos da watchlist — altas, baixas, volume relativo e sinais ativos.
 * A API não tem ranking de mercado; cada valor vem das rotas reais de cada ativo. */
export default function Rankings() {
  const { data, isError, refetch } = useRankings();

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      <header>
        <h2 className="text-2xl font-bold">Rankings</h2>
        <p className="mt-1">Altas, baixas, volume relativo e sinais entre os ativos da sua watchlist.</p>
      </header>

      {data?.total === 0 ? (
        <Card>
          <Empty
            action={
              <Link to="/" className="btn-ghost mt-1 px-3 py-1.5 text-xs">
                Ir para a watchlist
              </Link>
            }
          >
            Sua watchlist está vazia. Adicione ativos para ver os rankings.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <RankingCard
            title="Maiores altas"
            icon={TrendingUp}
            tone="up"
            itens={data?.altas}
            vazio="Nenhum ativo da watchlist em alta hoje."
            isError={isError}
            onRetry={refetch}
            render={(it) => <span className="num text-sm font-semibold text-up">{fmtPct(it.variacao_pct)}</span>}
          />
          <RankingCard
            title="Maiores baixas"
            icon={TrendingDown}
            tone="down"
            itens={data?.baixas}
            vazio="Nenhum ativo da watchlist em baixa hoje."
            isError={isError}
            onRetry={refetch}
            render={(it) => <span className="num text-sm font-semibold text-down">{fmtPct(it.variacao_pct)}</span>}
          />
          <RankingCard
            title="Maior volume relativo"
            icon={Activity}
            tone="purple"
            itens={data?.volume}
            vazio="Volume relativo indisponível no momento."
            isError={isError}
            onRetry={refetch}
            render={(it) => <span className="num text-sm font-semibold text-fg-0">{fmtNum(it.volRel, 2)}×</span>}
          />
          <RankingCard
            title="Mais sinais ativos"
            icon={Radar}
            tone="amber"
            itens={data?.sinais}
            vazio="Nenhum sinal ativo na watchlist."
            isError={isError}
            onRetry={refetch}
            render={(it) => <Pill tone="blue">{it.sinais}</Pill>}
          />
        </div>
      )}
    </div>
  );
}

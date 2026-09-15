import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellOff,
  CloudOff,
  Sparkles,
  Trash2,
  Wallet,
  TrendingUp,
  Activity,
  Radar,
  LineChart as LineChartIcon,
  Newspaper,
  Landmark,
  Bitcoin,
  ChevronRight,
} from 'lucide-react';
import {
  useWatchlist,
  useSignals,
  usePortfolio,
  usePositions,
  useDailySummary,
  useWatchlistMutations,
  useHistory,
  useTopMovers,
  useNews,
} from '../hooks/queries.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { generateCandles, PERIODS } from '../api/mock/assets.js';
import { Card, Kpi, Pill, Skeleton, Empty, ErrorState, SectionTitle } from '../components/ui.jsx';
import { Sparkline, RsiChart } from '../components/Charts.jsx';
import PriceChart from '../components/PriceChart.jsx';
import Disclaimer from '../components/Disclaimer.jsx';
import { fmtBRL, fmtNum, fmtPct, sinceNow, trendClass } from '../lib/format.js';

function MarketChartCard({ watchlist }) {
  const [ticker, setTicker] = useState('');
  const [periodo, setPeriodo] = useState('3m');
  const ativo = ticker || watchlist?.[0]?.ticker;
  const item = (watchlist ?? []).find((w) => w.ticker === ativo);
  const { data: hist, isLoading, isError, refetch } = useHistory(ativo, periodo);
  const mobile = useMediaQuery('(max-width: 639px)');

  if (!ativo) return null;

  return (
    <Card
      title={<SectionTitle icon={LineChartIcon}>Gráfico do ativo</SectionTitle>}
      bodyClass="p-2 pt-0"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-24 py-1.5 text-xs sm:w-28"
            value={ativo}
            onChange={(e) => setTicker(e.target.value)}
          >
            {(watchlist ?? []).map((w) => (
              <option key={w.ticker} value={w.ticker}>
                {w.ticker}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-0.5 rounded-sm bg-elevated p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`num rounded-[6px] px-2 py-1 text-xs font-semibold ${
                  periodo === p.id ? 'bg-muted text-fg-0 shadow-sm' : 'text-fg-3 hover:text-fg-1'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-2.5">
        <div className="flex items-center gap-3">
          <span className="num text-lg font-bold text-fg-0">{ativo}</span>
          {item && (
            <>
              <span className="num text-sm text-fg-2">{fmtNum(item.cotacao.preco)}</span>
              <span className={`num text-sm font-semibold ${trendClass(item.cotacao.variacao_pct)}`}>
                {fmtPct(item.cotacao.variacao_pct)}
              </span>
            </>
          )}
        </div>
        <Link to={`/ativo/${ativo}`} className="text-xs font-semibold text-accent">
          Ver análise completa →
        </Link>
      </div>
      {isLoading || (!hist && !isError) ? (
        <Skeleton className={`mx-2 ${mobile ? 'h-[220px]' : 'h-[300px]'}`} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          <PriceChart
            candles={hist.candles}
            indicators={hist.indicators}
            moeda={item?.moeda ?? 'BRL'}
            height={mobile ? 200 : 280}
          />
          <div className="mt-2 border-t border-border-soft px-2 pt-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-fg-3">RSI (14)</div>
            <RsiChart candles={hist.candles} values={hist.indicators.rsi14} height={mobile ? 70 : 90} />
          </div>
        </>
      )}
    </Card>
  );
}

function TopMoversCard() {
  const { data, isError, refetch } = useTopMovers();
  return (
    <Card title={<SectionTitle icon={TrendingUp}>Maiores altas e baixas</SectionTitle>} bodyClass="p-0">
      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data ? (
        <div className="grid gap-2 p-4">
          <Skeleton /> <Skeleton /> <Skeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-border-soft">
          <div>
            <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-up">Altas</div>
            <ul>
              {data.altas.map((q) => (
                <li key={q.ticker}>
                  <Link to={`/ativo/${q.ticker}`} className="flex items-center justify-between px-4 py-2 hover:bg-elevated">
                    <span className="num text-sm font-bold text-fg-0">{q.ticker}</span>
                    <span className="num text-sm font-semibold text-up">{fmtPct(q.variacao_pct)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-down">Baixas</div>
            <ul>
              {data.baixas.map((q) => (
                <li key={q.ticker}>
                  <Link to={`/ativo/${q.ticker}`} className="flex items-center justify-between px-4 py-2 hover:bg-elevated">
                    <span className="num text-sm font-bold text-fg-0">{q.ticker}</span>
                    <span className="num text-sm font-semibold text-down">{fmtPct(q.variacao_pct)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function NewsCard() {
  const { data: news, isError, refetch } = useNews();
  return (
    <Card title={<SectionTitle icon={Newspaper}>Notícias do mercado</SectionTitle>} bodyClass="p-0">
      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : !news ? (
        <div className="grid gap-2 p-4">
          <Skeleton /> <Skeleton /> <Skeleton className="h-4 w-2/3" />
        </div>
      ) : news.length === 0 ? (
        <Empty>Nenhuma notícia no momento.</Empty>
      ) : (
        <ul>
          {news.slice(0, 5).map((n) => (
            <li key={n.id} className="border-b border-border-soft px-4 py-2.5 last:border-0">
              <Link to={`/ativo/${n.ticker}`} className="block hover:text-accent">
                <p className="text-sm text-fg-1">{n.titulo}</p>
                <p className="mt-1 text-xs text-fg-3">
                  <span className="num font-semibold">{n.ticker}</span> · {n.fonte} · há {sinceNow(n.data)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const AVATAR_COLORS = ['#3aa0ff', '#22c58a', '#a855f7', '#f5a623', '#fb5468', '#64748b'];

function AllocationSplitCard({ positions }) {
  const pos = positions ?? [];

  const ladoDe = (filtro) =>
    pos
      .filter(filtro)
      .map((p) => ({ ticker: p.ticker, nome: p.setorLabel ?? p.setor, valor: p.valor_atual_brl }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

  const acoes = ladoDe((p) => p.tipo !== 'CRIPTO');
  const cripto = ladoDe((p) => p.tipo === 'CRIPTO');

  return (
    <Card bodyClass="p-5 sm:p-6">
      <h3 className="mb-5 text-center text-lg font-bold text-fg-0 sm:text-xl">Ações vs. Cripto</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <RankingColumn icon={Landmark} tone="var(--accent)" label="Ações & Fundos" subtitulo="Maior valor investido" itens={acoes} />
        <RankingColumn icon={Bitcoin} tone="var(--amber)" label="Cripto" subtitulo="Maior valor investido" itens={cripto} />
      </div>
    </Card>
  );
}

function RankingColumn({ icon: Icon, tone, label, subtitulo, itens }) {
  return (
    <div className="rounded-2xl border border-border-soft p-5">
      <div className="flex flex-col items-center gap-2 pb-4 text-center">
        <div className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2"
            style={{ borderColor: tone, color: tone }}
          >
            <Icon size={14} />
          </span>
          <h4 className="text-lg font-bold text-fg-0">{label}</h4>
        </div>
        <p className="text-sm font-semibold text-fg-2">{subtitulo}</p>
      </div>

      {itens.length === 0 ? (
        <p className="py-4 text-center text-xs text-fg-3">Nenhuma posição nesta classe.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {itens.map((item, i) => (
            <li key={item.ticker}>
              <Link
                to={`/ativo/${item.ticker}`}
                className="flex items-center gap-3 px-1 py-3 hover:bg-muted"
              >
                <span className="w-6 shrink-0 text-sm font-bold text-brand">#{i + 1}</span>
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
                  style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                >
                  {item.ticker.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="num block truncate text-sm font-bold text-fg-0">{item.ticker}</span>
                  <span className="block truncate text-xs text-fg-3">{item.nome}</span>
                </span>
                <span className="num shrink-0 text-sm font-semibold text-fg-0">{fmtBRL(item.valor)}</span>
                <ChevronRight size={16} className="shrink-0 text-fg-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/portfolio"
        className="mt-4 block rounded-lg border border-border-main py-2.5 text-center text-sm font-semibold text-fg-1 hover:bg-muted"
      >
        Ver Ranking
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { data: watchlist, isLoading, isError: erroWatchlist, refetch: refazerWatchlist } = useWatchlist();
  const { data: signals, isError: erroSignals, refetch: refazerSignals } = useSignals({ apenasAtivos: true });
  const { data: portfolio } = usePortfolio();
  const { data: positions, isError: erroPositions, refetch: refazerPositions } = usePositions();
  const { data: resumo, isError: erroResumo } = useDailySummary();
  const { remove, toggle } = useWatchlistMutations();

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      <header>
        <h2 className="text-2xl font-bold">Visão geral</h2>
        <p className="mt-1">
          {watchlist?.length ?? 0} ativos em watchlist · {signals?.length ?? 0} sinais ativos
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          icon={Wallet}
          label="Patrimônio simulado"
          value={portfolio ? fmtBRL(portfolio.valor_total) : '—'}
          hint={portfolio ? `Custo ${fmtBRL(portfolio.custo_total)}` : ''}
        />
        <Kpi
          icon={TrendingUp}
          iconTone={portfolio?.resultado >= 0 ? 'up' : 'down'}
          label="Resultado não realizado"
          value={portfolio ? fmtBRL(portfolio.resultado) : '—'}
          tone={portfolio ? trendClass(portfolio.resultado) : ''}
          hint={portfolio ? fmtPct(portfolio.resultado_pct) : ''}
        />
        <Kpi
          icon={Activity}
          iconTone={portfolio?.variacao_dia_pct >= 0 ? 'up' : 'down'}
          label="Variação do dia"
          value={portfolio ? fmtPct(portfolio.variacao_dia_pct) : '—'}
          tone={portfolio ? trendClass(portfolio.variacao_dia_pct) : ''}
          hint="Ibovespa +0,31% · CDI +0,04%"
        />
        <Kpi
          icon={Radar}
          iconTone="amber"
          live={(signals?.length ?? 0) > 0}
          label="Sinais ativos"
          value={signals?.length ?? '—'}
          hint="Reavaliação a cada 15 min no pregão"
        />
      </div>

      {erroPositions ? (
        <Card bodyClass="p-5 sm:p-6">
          <ErrorState message="Não foi possível carregar as posições." onRetry={refazerPositions} />
        </Card>
      ) : positions ? (
        <AllocationSplitCard positions={positions} />
      ) : (
        <Card bodyClass="p-5 sm:p-6">
          <Skeleton className="mx-auto mb-5 h-6 w-48" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </Card>
      )}

      {(watchlist ?? []).length > 0 && <MarketChartCard watchlist={watchlist} />}

      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-6">
        <Card
          title={<SectionTitle icon={Wallet}>Watchlist</SectionTitle>}
          action={<Link to="/busca" className="text-xs font-semibold">Adicionar ativo</Link>}
          bodyClass="p-0"
        >
          {isLoading ? (
            <div className="grid gap-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : erroWatchlist ? (
            <ErrorState message="Não foi possível carregar a watchlist." onRetry={refazerWatchlist} />
          ) : (watchlist ?? []).length === 0 ? (
            <Empty action={<Link to="/busca" className="btn-ghost px-3 py-1.5 text-xs">Buscar ativos</Link>}>
              Nenhum ativo na watchlist.
            </Empty>
          ) : (
            <div className="overflow-x-auto">
            <table className="table-zebra w-full min-w-[520px] text-sm">
              <thead className="text-xs uppercase tracking-wider text-fg-3">
                <tr className="border-b border-border-soft">
                  <th className="px-4 py-2 text-left font-medium">Ativo</th>
                  <th className="px-2 py-2 text-right font-medium">Preço</th>
                  <th className="px-2 py-2 text-right font-medium">Dia</th>
                  <th className="hidden px-2 py-2 text-left font-medium md:table-cell">40 pregões</th>
                  <th className="px-2 py-2 text-center font-medium">Sinais</th>
                  <th className="px-4 py-2 text-right font-medium">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((w) => (
                  <tr key={w.ticker} className="border-b border-border-soft last:border-0 hover:bg-elevated">
                    <td className="px-4 py-2.5">
                      <Link to={`/ativo/${w.ticker}`} className="block">
                        <span className="num font-bold text-fg-0">{w.ticker}</span>
                        <span className="ml-2 text-xs text-fg-3">{w.tipo}</span>
                        <div className="truncate text-xs text-fg-2">{w.nome}</div>
                      </Link>
                    </td>
                    <td className="num px-2 py-2.5 text-right text-fg-0">{fmtNum(w.cotacao.preco)}</td>
                    <td className={`num px-2 py-2.5 text-right ${trendClass(w.cotacao.variacao_pct)}`}>
                      {fmtPct(w.cotacao.variacao_pct)}
                    </td>
                    <td className="hidden w-32 px-2 py-2.5 md:table-cell">
                      <Sparkline candles={generateCandles(w.ticker)} positive={w.cotacao.variacao_pct >= 0} />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {w.sinais > 0 ? <Pill tone="blue">{w.sinais}</Pill> : <span className="text-fg-3">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggle.mutate(w.ticker)}
                          title={w.notificar ? 'Desabilitar notificações' : 'Habilitar notificações'}
                          className={`rounded-sm p-1.5 hover:bg-muted ${w.notificar ? 'text-accent' : 'text-fg-3'}`}
                        >
                          {w.notificar ? <Bell size={15} /> : <BellOff size={15} />}
                        </button>
                        <button
                          onClick={() => remove.mutate(w.ticker)}
                          title="Remover da watchlist"
                          className="rounded-sm p-1.5 text-fg-3 hover:bg-muted hover:text-down"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>

          <TopMoversCard />

          <NewsCard />
        </div>

        <div className="grid content-start gap-6">
          <Card
            title="Resumo diário"
            action={<Sparkles size={15} className="text-purple" />}
          >
            {resumo ? (
              <>
                <p className="text-fg-1">{resumo.texto}</p>
                <Disclaimer className="mt-3" />
              </>
            ) : erroResumo ? (
              <div className="flex items-start gap-2.5 rounded-sm border border-border-soft bg-elevated px-3 py-2.5">
                <CloudOff size={16} className="mt-0.5 shrink-0 text-fg-3" />
                <p className="text-xs text-fg-3">
                  Resumo diário por IA indisponível no momento. Os dados numéricos dos cartões acima continuam
                  disponíveis normalmente.
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                <Skeleton /> <Skeleton /> <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </Card>

          <Card title={<SectionTitle icon={Radar} tone="amber">Sinais ativos</SectionTitle>} bodyClass="p-0">
            {erroSignals ? (
              <ErrorState onRetry={refazerSignals} />
            ) : !signals ? (
              <div className="grid gap-3 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : signals.length === 0 ? (
              <Empty>Nenhum sinal ativo.</Empty>
            ) : (
              <ul>
                {signals.map((s) => (
                  <li key={s.id} className="border-b border-border-soft last:border-0">
                    <Link to={`/ativo/${s.ticker}`} className="flex items-start gap-3 px-4 py-3 hover:bg-elevated">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="signal-ping shrink-0" />
                          <span className="num text-sm font-bold text-fg-0">{s.ticker}</span>
                          <Pill tone={s.regra.tom}>{s.regra.nome}</Pill>
                        </div>
                        <p className="mt-1 text-xs">
                          {s.backtest.ocorrencias} ocorrências em 24 meses · retorno médio {fmtPct(s.backtest.ret20)} em
                          20 pregões
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-fg-3">{sinceNow(s.data_ativacao)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}

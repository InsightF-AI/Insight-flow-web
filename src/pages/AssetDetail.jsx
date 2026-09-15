import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CloudOff, Plus, Sparkles, Target, Radar, Gauge, BarChart3, Receipt, Landmark, Newspaper } from 'lucide-react';
import { useAsset, useHistory, useIndicators, useSignals, useScore, useAnalysis, useWatchlist, useWatchlistMutations, useNews } from '../hooks/queries.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useUiStore } from '../store/index.js';
import { PERIODS } from '../api/mock/assets.js';
import { Card, Pill, Skeleton, Empty, ErrorState, SectionTitle } from '../components/ui.jsx';
import PriceChart from '../components/PriceChart.jsx';
import { RsiChart, MacdChart } from '../components/Charts.jsx';
import OperationModal from '../components/OperationModal.jsx';
import Disclaimer from '../components/Disclaimer.jsx';
import { fmtNum, fmtPct, fmtCompact, sinceNow, trendClass } from '../lib/format.js';

const OVERLAYS = [
  { k: 'sma20', label: 'SMA 20', color: 'var(--chart-sma20)' },
  { k: 'sma50', label: 'SMA 50', color: 'var(--chart-sma50)' },
  { k: 'sma200', label: 'SMA 200', color: 'var(--chart-sma200)' },
  { k: 'bollinger', label: 'Bollinger', color: 'var(--chart-bollinger)' },
];

export default function AssetDetail() {
  const { ticker } = useParams();
  const { periodo, setPeriodo, overlays, toggleOverlay } = useUiStore();
  const { data: asset } = useAsset(ticker);
  const { data: hist, isLoading: loadingHist, isError: erroHist, refetch: refazerHist } = useHistory(ticker, periodo);
  const { data: snapshot, isError: erroSnapshot, refetch: refazerSnapshot } = useIndicators(ticker);
  const {
    data: signals,
    isLoading: loadingSignals,
    isError: erroSignals,
    refetch: refazerSignals,
  } = useSignals({ ticker, apenasAtivos: false });
  const { data: score, isError: erroScore, refetch: refazerScore } = useScore(ticker);
  const { data: analysis, isLoading: loadingAI, isError: erroAI } = useAnalysis(ticker);
  const { data: news, isError: erroNews, refetch: refazerNews } = useNews(ticker);
  const mobile = useMediaQuery('(max-width: 639px)');
  const { data: watchlist } = useWatchlist();
  const { add, remove } = useWatchlistMutations();
  const naWatchlist = (watchlist ?? []).some((w) => w.ticker === ticker);
  const [opModal, setOpModal] = useState(false);

  const cot = asset?.cotacao;

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/" className="mb-2 inline-flex items-center gap-1.5 text-xs text-fg-2 hover:text-fg-0">
            <ArrowLeft size={13} /> Voltar ao dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="num text-2xl font-bold">{ticker}</h2>
            {asset && (
              <>
                <Pill tone={asset.tipo === 'CRIPTO' ? 'purple' : 'blue'}>{asset.tipo}</Pill>
                <span className="text-sm text-fg-2">{asset.nome}</span>
              </>
            )}
          </div>
          {asset && (
            <p className="mt-1 text-xs text-fg-3">
              {asset.setor} · {asset.moeda} · fonte {asset.fonte}
            </p>
          )}
        </div>

        <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto sm:gap-6">
          <div className="text-right">
            {cot ? (
              <>
                <div className="num text-2xl font-bold leading-none">{fmtNum(cot.preco)}</div>
                <div className={`num mt-1 text-sm ${trendClass(cot.variacao_pct)}`}>
                  {fmtNum(cot.variacao)} ({fmtPct(cot.variacao_pct)}) hoje
                </div>
              </>
            ) : (
              <Skeleton className="h-8 w-28" />
            )}
          </div>
          <button onClick={() => setOpModal(true)} className="btn-ghost">
            <Receipt size={15} /> Nova operação
          </button>
          <button
            className={naWatchlist ? 'btn-ghost' : 'btn-primary'}
            onClick={() => (naWatchlist ? remove.mutate(ticker) : add.mutate(ticker))}
          >
            {naWatchlist ? 'Na watchlist' : <><Plus size={15} /> Watchlist</>}
          </button>
        </div>
      </header>

      <OperationModal open={opModal} onClose={() => setOpModal(false)} initialTicker={ticker} />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="grid content-start gap-6">
          <Card
            bodyClass="p-2 pt-0"
            title={<SectionTitle icon={BarChart3}>Histórico OHLCV</SectionTitle>}
            action={
              <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex flex-wrap gap-3 px-2 py-2.5">
              {OVERLAYS.map((o) => (
                <label key={o.k} className="flex cursor-pointer items-center gap-1.5 text-xs text-fg-2">
                  <input
                    type="checkbox"
                    checked={!!overlays[o.k]}
                    onChange={() => toggleOverlay(o.k)}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  <span className="h-0.5 w-4 rounded-full" style={{ background: o.color }} />
                  {o.label}
                </label>
              ))}
            </div>
            {loadingHist ? (
              <Skeleton className={`mx-2 ${mobile ? 'h-[260px]' : 'h-[380px]'}`} />
            ) : erroHist ? (
              <ErrorState onRetry={refazerHist} />
            ) : (
              <PriceChart
                candles={hist.candles}
                indicators={hist.indicators}
                moeda={asset?.moeda ?? 'BRL'}
                height={mobile ? 260 : 380}
              />
            )}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="RSI (14)" bodyClass="p-2">
              {erroHist ? (
                <ErrorState onRetry={refazerHist} />
              ) : hist ? (
                <RsiChart candles={hist.candles} values={hist.indicators.rsi14} height={mobile ? 100 : 130} />
              ) : (
                <Skeleton className={mobile ? 'h-[100px]' : 'h-[130px]'} />
              )}
            </Card>
            <Card title="MACD (12, 26, 9)" bodyClass="p-2">
              {erroHist ? (
                <ErrorState onRetry={refazerHist} />
              ) : hist ? (
                <MacdChart candles={hist.candles} macd={hist.indicators.macd} height={mobile ? 100 : 130} />
              ) : (
                <Skeleton className={mobile ? 'h-[100px]' : 'h-[130px]'} />
              )}
            </Card>
          </div>

          <Card
            title={
              <SectionTitle icon={Radar} tone="amber">
                Sinais e contexto histórico
              </SectionTitle>
            }
            bodyClass="p-0"
          >
            {erroSignals ? (
              <ErrorState onRetry={refazerSignals} />
            ) : loadingSignals ? (
              <div className="grid gap-3 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (signals ?? []).length === 0 ? (
              <Empty>Nenhum sinal registrado para este ativo.</Empty>
            ) : (
              <ul>
                {signals.map((s) => (
                  <li key={s.id} className="border-b border-border-soft p-4 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={s.data_desativacao ? 'slate' : s.regra.tom}>{s.regra.nome}</Pill>
                      <span className="text-xs text-fg-3">
                        {s.data_desativacao ? `encerrado há ${sinceNow(s.data_desativacao)}` : `ativo há ${sinceNow(s.data_ativacao)}`}
                      </span>
                      <span className="ml-auto text-xs text-fg-3">peso {fmtNum(s.regra.peso, 2)}</span>
                    </div>
                    <p className="mt-2">{s.regra.descricao}</p>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                      {Object.entries(s.contexto).map(([k, v]) => (
                        <span key={k} className="text-xs text-fg-2">
                          {k} <span className="num font-semibold text-fg-0">{fmtNum(v)}</span>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-sm border border-border-soft bg-elevated p-3 sm:grid-cols-4">
                      {[
                        ['Ocorrências (24m)', s.backtest.ocorrencias],
                        ['Retorno médio 5p', fmtPct(s.backtest.ret5)],
                        ['Retorno médio 20p', fmtPct(s.backtest.ret20)],
                        ['Retorno médio 60p', fmtPct(s.backtest.ret60)],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <div className="text-[11px] uppercase tracking-wider text-fg-3">{label}</div>
                          <div className="num text-sm font-bold text-fg-0">{val}</div>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card title={<SectionTitle icon={Target}>Score de oportunidade</SectionTitle>}>
            {erroScore ? (
              <ErrorState onRetry={refazerScore} />
            ) : score ? (
              <div className="flex items-center gap-4">
                <div className="num text-4xl font-extrabold text-fg-0">{score.score}</div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${score.score}%` }} />
                  </div>
                  <p className="mt-2 text-xs">
                    Soma ponderada dos {score.sinais} sinais ativos. Indicador técnico agregado, não recomendação.
                  </p>
                </div>
              </div>
            ) : (
              <Skeleton className="h-12" />
            )}
          </Card>

          {asset?.fundamentos && (
            <Card title={<SectionTitle icon={Landmark} tone="amber">Indicadores fundamentalistas</SectionTitle>}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-fg-3">P/L</dt>
                  <dd className="num font-semibold text-fg-0">
                    {asset.fundamentos.pl == null ? '—' : fmtNum(asset.fundamentos.pl, 1)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-3">P/VP</dt>
                  <dd className="num font-semibold text-fg-0">
                    {asset.fundamentos.pvp == null ? '—' : fmtNum(asset.fundamentos.pvp, 2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-3">Dividend Yield</dt>
                  <dd className="num font-semibold text-fg-0">
                    {asset.fundamentos.dy == null ? '—' : fmtPct(asset.fundamentos.dy)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-3">ROE</dt>
                  <dd className="num font-semibold text-fg-0">
                    {asset.fundamentos.roe == null ? '—' : fmtPct(asset.fundamentos.roe)}
                  </dd>
                </div>
              </dl>
            </Card>
          )}

          <Card title="Análise por IA" action={<Sparkles size={15} className="text-purple" />}>
            {loadingAI ? (
              <div className="grid gap-2">
                <Skeleton /> <Skeleton /> <Skeleton /> <Skeleton className="h-4 w-1/2" />
              </div>
            ) : erroAI ? (
              <div className="flex items-start gap-2.5 rounded-sm border border-border-soft bg-elevated px-3 py-2.5">
                <CloudOff size={16} className="mt-0.5 shrink-0 text-fg-3" />
                <p className="text-xs text-fg-3">
                  Análise por IA indisponível no momento. Os indicadores calculados abaixo continuam disponíveis
                  normalmente.
                </p>
              </div>
            ) : (
              <>
                <p className="text-fg-1">{analysis?.texto}</p>
                <p className="mt-3 text-xs text-fg-3">
                  provedor {analysis?.provedor} · modelo {analysis?.modelo} · prompt {analysis?.prompt_versao}
                </p>
                <Disclaimer className="mt-3" />
              </>
            )}
          </Card>

          <Card title={<SectionTitle icon={Gauge} tone="purple">Indicadores calculados</SectionTitle>} bodyClass="p-0">
            {erroSnapshot ? (
              <ErrorState onRetry={refazerSnapshot} />
            ) : snapshot ? (
              <dl>
                {Object.entries(snapshot).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-border-soft px-4 py-2.5 last:border-0">
                    <dt className="text-sm text-fg-2">{k}</dt>
                    <dd className="num text-sm font-semibold text-fg-0">{v == null ? '—' : fmtNum(v, k === 'Volume relativo' ? 2 : 2)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="grid gap-2 p-4">
                <Skeleton /> <Skeleton /> <Skeleton />
              </div>
            )}
          </Card>

          <Card title="Cotação">
            {cot ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-fg-3">Volume do dia</dt>
                  <dd className="num font-semibold">{fmtCompact(cot.volume)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-3">Atualizado</dt>
                  <dd className="num font-semibold">
                    {new Date(cot.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-3">Cache</dt>
                  <dd className="font-semibold">60 s</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-3">Reavaliação de sinais</dt>
                  <dd className="font-semibold">{asset?.tipo === 'CRIPTO' ? '5 min' : '15 min'}</dd>
                </div>
              </dl>
            ) : (
              <Skeleton className="h-16" />
            )}
          </Card>

          <Card title={<SectionTitle icon={Newspaper}>Notícias</SectionTitle>} bodyClass="p-0">
            {erroNews ? (
              <ErrorState onRetry={refazerNews} />
            ) : !news ? (
              <div className="grid gap-2 p-4">
                <Skeleton /> <Skeleton /> <Skeleton className="h-4 w-2/3" />
              </div>
            ) : news.length === 0 ? (
              <Empty>Nenhuma notícia recente para este ativo.</Empty>
            ) : (
              <ul>
                {news.map((n) => (
                  <li key={n.id} className="border-b border-border-soft px-4 py-3 last:border-0">
                    <p className="text-sm text-fg-1">{n.titulo}</p>
                    <p className="mt-1 text-xs text-fg-3">
                      {n.fonte} · há {sinceNow(n.data)}
                    </p>
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Wallet, Coins, TrendingUp, Scale, ListOrdered, PieChart as PieChartIcon, Receipt, Trash2, Download } from 'lucide-react';
import { usePositions, usePortfolio, useDistribution, useOperations, useDeleteOperation } from '../hooks/queries.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { Card, Kpi, Pill, Skeleton, Empty, ErrorState, SectionTitle } from '../components/ui.jsx';
import { BenchmarkChart, DonutChart } from '../components/Charts.jsx';
import OperationModal from '../components/OperationModal.jsx';
import { USD_BRL } from '../api/mock/assets.js';
import { fmtBRL, fmtNum, fmtPct, fmtDate, trendClass } from '../lib/format.js';

const BAR_COLORS = [
  'var(--chart-sma20)',
  'var(--chart-bench-portfolio)',
  'var(--chart-sma200)',
  'var(--chart-sma50)',
  'var(--chart-axis)',
];

const TIPOS_POSICAO = ['TODAS', 'ACAO', 'FII', 'ETF', 'CRIPTO'];

function DistributionList({ titulo, itens }) {
  return (
    <div>
      <h5 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-3">{titulo}</h5>
      <ul className="grid gap-2">
        {itens.map((d, i) => (
          <li key={d.nome}>
            <div className="flex justify-between text-sm">
              <span className="text-fg-1">{d.nome}</span>
              <span className="num text-fg-2">{fmtNum(d.pct, 1)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DistribuicaoPorClasse({ itens }) {
  const mobile = useMediaQuery('(max-width: 639px)');
  return (
    <div>
      <h5 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-3">Por classe de ativo</h5>
      <div className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[140px_1fr] sm:gap-4">
        <DonutChart data={itens} height={mobile ? 110 : 140} />
        <ul className="grid gap-1.5">
          {itens.map((d, i) => (
            <li key={d.nome} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-fg-1">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                />
                {d.nome}
              </span>
              <span className="num text-fg-2">{fmtNum(d.pct, 1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Portfolio() {
  const [modal, setModal] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState('TODAS');
  const { data: pos, isLoading, isError: erroPos, refetch: refazerPos } = usePositions();
  const { data: resumo, isError: erroResumo, refetch: refazerResumo } = usePortfolio();
  const { data: dist, isError: erroDist, refetch: refazerDist } = useDistribution();
  const { data: ops, isLoading: carregandoOps, isError: erroOps, refetch: refazerOps } = useOperations();
  const deleteOp = useDeleteOperation();
  const mobile = useMediaQuery('(max-width: 639px)');

  const posFiltrado = (pos ?? []).filter((p) => tipoFiltro === 'TODAS' || p.tipo === tipoFiltro);

  const exportarOperacoesCsv = () => {
    const linhas = [
      ['Tipo', 'Ativo', 'Quantidade', 'Preço unitário', 'Total', 'Data'].join(','),
      ...(ops ?? []).map((o) =>
        [o.tipo, o.ticker, o.quantidade, o.preco_unitario, (o.quantidade * o.preco_unitario).toFixed(2), o.data].join(','),
      ),
    ];
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'insightflow-operacoes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Portfólio</h2>
          <p className="mt-1">Operações fictícias. O sistema não executa ordens em corretora.</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>
          <Plus size={15} /> Nova operação
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          icon={Wallet}
          label="Valor de mercado"
          value={resumo ? fmtBRL(resumo.valor_total) : '—'}
          hint={resumo ? `${pos?.length ?? 0} posições · posições em USD convertidas a ${fmtNum(USD_BRL)}` : ''}
        />
        <Kpi icon={Coins} iconTone="amber" label="Custo total" value={resumo ? fmtBRL(resumo.custo_total) : '—'} />
        <Kpi
          icon={TrendingUp}
          iconTone={resumo?.resultado >= 0 ? 'up' : 'down'}
          label="Resultado"
          value={resumo ? fmtBRL(resumo.resultado) : '—'}
          tone={resumo ? trendClass(resumo.resultado) : ''}
          hint={resumo ? fmtPct(resumo.resultado_pct) : ''}
        />
        <Kpi
          icon={Scale}
          iconTone="purple"
          label="Contra benchmarks"
          value={resumo ? fmtPct(resumo.resultado_pct - resumo.benchmarks.ibovespa) : '—'}
          tone={resumo ? trendClass(resumo.resultado_pct - resumo.benchmarks.ibovespa) : ''}
          hint={resumo ? `Ibovespa ${fmtPct(resumo.benchmarks.ibovespa)} · CDI ${fmtPct(resumo.benchmarks.cdi)}` : ''}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title={<SectionTitle icon={TrendingUp}>Carteira vs. benchmarks (base 100)</SectionTitle>} bodyClass="p-3">
          {erroResumo ? (
            <ErrorState onRetry={refazerResumo} />
          ) : resumo ? (
            <BenchmarkChart data={resumo.curva} height={mobile ? 180 : 240} />
          ) : (
            <Skeleton className={mobile ? 'h-[180px]' : 'h-[240px]'} />
          )}
        </Card>
        <Card title={<SectionTitle icon={PieChartIcon} tone="purple">Distribuição</SectionTitle>}>
          {erroDist ? (
            <ErrorState onRetry={refazerDist} />
          ) : dist ? (
            <div className="grid gap-5">
              <DistribuicaoPorClasse itens={dist.classe} />
              <DistributionList titulo="Por setor" itens={dist.setor} />
              <DistributionList titulo="Por moeda" itens={dist.moeda} />
            </div>
          ) : (
            <div className="grid gap-2">
              <Skeleton /> <Skeleton /> <Skeleton />
            </div>
          )}
        </Card>
      </div>

      <Card
        title={<SectionTitle icon={ListOrdered}>Posições</SectionTitle>}
        action={
          <div className="flex flex-wrap gap-0.5 rounded-sm bg-elevated p-0.5">
            {TIPOS_POSICAO.map((t) => (
              <button
                key={t}
                onClick={() => setTipoFiltro(t)}
                className={`rounded-[6px] px-2.5 py-1 text-xs font-semibold ${
                  tipoFiltro === t ? 'bg-muted text-fg-0 shadow-sm' : 'text-fg-3 hover:text-fg-1'
                }`}
              >
                {t === 'TODAS' ? 'Todas' : t}
              </button>
            ))}
          </div>
        }
        bodyClass="p-0"
      >
        {isLoading ? (
          <div className="grid gap-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : erroPos ? (
          <ErrorState onRetry={refazerPos} />
        ) : posFiltrado.length === 0 ? (
          <Empty>Nenhuma posição para este filtro.</Empty>
        ) : (
          <>
            {/* RNF-07 — abaixo de sm a tabela vira cartões empilhados; a partir de sm, a
             * tabela original volta (ver bloco hidden sm:block logo abaixo). */}
            <ul className="sm:hidden">
              {posFiltrado.map((p) => (
                <li key={p.ticker} className="border-b border-border-soft p-4 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/ativo/${p.ticker}`} className="min-w-0">
                      <span className="num font-bold text-fg-0">{p.ticker}</span>
                      <div className="truncate text-xs text-fg-2">{p.tipo === 'CRIPTO' ? 'CRIPTO' : p.setor}</div>
                    </Link>
                    <div className="shrink-0 text-right">
                      <div className="num font-semibold text-fg-0">{fmtBRL(p.valor_atual, p.moeda)}</div>
                      <div className={`num text-xs ${trendClass(p.resultado)}`}>
                        {fmtBRL(p.resultado, p.moeda)} ({fmtPct(p.resultado_pct)})
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-3">
                    <span>
                      Qtd. <span className="num text-fg-1">{fmtNum(p.quantidade, p.tipo === 'CRIPTO' ? 4 : 0)}</span>
                    </span>
                    <span>
                      Médio <span className="num text-fg-1">{fmtNum(p.preco_medio)}</span>
                    </span>
                    <span>
                      Atual <span className="num text-fg-1">{fmtNum(p.preco_atual)}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="table-zebra w-full min-w-[720px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-fg-3">
                  <tr className="border-b border-border-soft">
                    <th className="px-4 py-2 text-left font-medium">Ativo</th>
                    <th className="px-2 py-2 text-right font-medium">Qtd.</th>
                    <th className="px-2 py-2 text-right font-medium">Preço médio</th>
                    <th className="px-2 py-2 text-right font-medium">Preço atual</th>
                    <th className="px-2 py-2 text-right font-medium">Valor</th>
                    <th className="px-4 py-2 text-right font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {posFiltrado.map((p) => (
                    <tr key={p.ticker} className="border-b border-border-soft last:border-0 hover:bg-elevated">
                      <td className="px-4 py-2.5">
                        <Link to={`/ativo/${p.ticker}`}>
                          <span className="num font-bold text-fg-0">{p.ticker}</span>
                          <div className="truncate text-xs text-fg-2">{p.tipo === 'CRIPTO' ? 'CRIPTO' : p.setor}</div>
                        </Link>
                      </td>
                      <td className="num px-2 py-2.5 text-right">{fmtNum(p.quantidade, p.tipo === 'CRIPTO' ? 4 : 0)}</td>
                      <td className="num px-2 py-2.5 text-right">{fmtNum(p.preco_medio)}</td>
                      <td className="num px-2 py-2.5 text-right">{fmtNum(p.preco_atual)}</td>
                      <td className="num px-2 py-2.5 text-right text-fg-0">{fmtBRL(p.valor_atual, p.moeda)}</td>
                      <td className={`num px-4 py-2.5 text-right ${trendClass(p.resultado)}`}>
                        {fmtBRL(p.resultado, p.moeda)}
                        <div className="text-xs">{fmtPct(p.resultado_pct)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card
        title={<SectionTitle icon={Receipt} tone="amber">Operações registradas</SectionTitle>}
        action={
          (ops ?? []).length > 0 && (
            <button onClick={exportarOperacoesCsv} className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <Download size={13} /> Exportar CSV
            </button>
          )
        }
        bodyClass="p-0"
      >
        {carregandoOps ? (
          <div className="grid gap-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : erroOps ? (
          <ErrorState onRetry={refazerOps} />
        ) : (ops ?? []).length === 0 ? (
          <Empty
            action={
              <button onClick={() => setModal(true)} className="btn-primary px-3 py-1.5 text-xs">
                <Plus size={13} /> Registrar operação
              </button>
            }
          >
            Nenhuma operação registrada.
          </Empty>
        ) : (
          <ul>
            {ops.map((o) => (
              <li key={o.id} className="border-b border-border-soft px-4 py-2.5 last:border-0">
                {/* RNF-07 — abaixo de sm, empilha em 2 linhas (a linha única cortava a data
                 * e o botão de excluir pra fora da tela em 375px). */}
                <div className="flex items-center gap-2 sm:hidden">
                  <Pill tone={o.tipo === 'COMPRA' ? 'green' : 'red'}>{o.tipo}</Pill>
                  <span className="num text-sm font-bold text-fg-0">{o.ticker}</span>
                  <span className="num ml-auto text-sm text-fg-1">{fmtBRL(o.quantidade * o.preco_unitario)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-fg-3 sm:hidden">
                  <span className="num">
                    {fmtNum(o.quantidade, o.quantidade < 1 ? 4 : 0)} × {fmtNum(o.preco_unitario)}
                  </span>
                  <span className="num">{fmtDate(o.data)}</span>
                  <button
                    onClick={() => deleteOp.mutate(o.id)}
                    title="Excluir operação"
                    className="ml-auto rounded-sm p-1 text-fg-3 hover:bg-muted hover:text-down"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  <Pill tone={o.tipo === 'COMPRA' ? 'green' : 'red'}>{o.tipo}</Pill>
                  <span className="num text-sm font-bold text-fg-0">{o.ticker}</span>
                  <span className="num text-sm text-fg-2">
                    {fmtNum(o.quantidade, o.quantidade < 1 ? 4 : 0)} × {fmtNum(o.preco_unitario)}
                  </span>
                  <span className="num ml-auto text-sm text-fg-1">{fmtBRL(o.quantidade * o.preco_unitario)}</span>
                  <span className="num w-20 text-right text-xs text-fg-3">{fmtDate(o.data)}</span>
                  <button
                    onClick={() => deleteOp.mutate(o.id)}
                    title="Excluir operação"
                    className="rounded-sm p-1.5 text-fg-3 hover:bg-muted hover:text-down"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <OperationModal open={modal} onClose={() => setModal(false)} />
    </div>
  );
}

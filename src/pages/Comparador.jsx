import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { ASSETS } from '../api/mock/assets.js';
import { useAsset, useIndicators, useScore } from '../hooks/queries.js';
import { Card, Empty, ErrorState, Skeleton } from '../components/ui.jsx';
import { fmtNum, fmtPct, trendClass } from '../lib/format.js';

const MAX = 4;

function Linha({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between border-b border-border-soft py-2 last:border-0">
      <span className="text-xs text-fg-3">{label}</span>
      <span className={`num text-sm font-semibold ${tone ?? 'text-fg-0'}`}>{value}</span>
    </div>
  );
}

function ComparadorColuna({ ticker, onRemove }) {
  const { data: asset, isError, refetch } = useAsset(ticker);
  const { data: snapshot } = useIndicators(ticker);
  const { data: score } = useScore(ticker);
  const cot = asset?.cotacao;

  return (
    <Card
      title={<span className="num text-sm font-bold text-fg-0">{ticker}</span>}
      action={
        <button onClick={() => onRemove(ticker)} title="Remover da comparação" className="text-fg-3 hover:text-down">
          <X size={15} />
        </button>
      }
    >
      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : !asset ? (
        <div className="grid gap-2">
          <Skeleton /> <Skeleton /> <Skeleton />
        </div>
      ) : (
        <div>
          <div className="mb-2 truncate text-xs text-fg-3">{asset.nome}</div>
          <Linha label="Preço" value={fmtNum(cot.preco)} />
          <Linha label="Variação do dia" value={fmtPct(cot.variacao_pct)} tone={trendClass(cot.variacao_pct)} />
          <Linha label="RSI (14)" value={snapshot ? fmtNum(snapshot['RSI (14)'], 1) : '—'} />
          <Linha label="Volume relativo" value={snapshot ? `${fmtNum(snapshot['Volume relativo'], 2)}×` : '—'} />
          <Linha label="Score de oportunidade" value={score ? score.score : '—'} />
          <Linha label="Sinais ativos" value={score ? score.sinais : '—'} />
        </div>
      )}
      <Link to={`/ativo/${ticker}`} className="mt-3 block text-center text-xs font-semibold text-accent">
        Ver detalhe completo →
      </Link>
    </Card>
  );
}

/** Comparador lado a lado — inspirado no comparador de ativos do investidor10. */
export default function Comparador() {
  const [tickers, setTickers] = useState(['PETR4', 'VALE3']);
  const [novo, setNovo] = useState('');

  const adicionar = () => {
    if (!novo || tickers.includes(novo) || tickers.length >= MAX) return;
    setTickers([...tickers, novo]);
    setNovo('');
  };
  const remover = (t) => setTickers(tickers.filter((x) => x !== t));
  const disponiveis = ASSETS.filter((a) => !tickers.includes(a.ticker));

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      <header>
        <h2 className="text-2xl font-bold">Comparador de ativos</h2>
        <p className="mt-1">Compare até {MAX} ativos lado a lado — preço, indicadores técnicos e sinais.</p>
      </header>

      {tickers.length < MAX && (
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-full sm:w-64" value={novo} onChange={(e) => setNovo(e.target.value)}>
            <option value="">Selecione um ativo…</option>
            {disponiveis.map((a) => (
              <option key={a.ticker} value={a.ticker}>
                {a.ticker} — {a.nome}
              </option>
            ))}
          </select>
          <button onClick={adicionar} disabled={!novo} className="btn-ghost">
            <Plus size={15} /> Adicionar à comparação
          </button>
        </div>
      )}

      {tickers.length === 0 ? (
        <Card>
          <Empty>Adicione ao menos um ativo para comparar.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tickers.map((t) => (
            <ComparadorColuna key={t} ticker={t} onRemove={remover} />
          ))}
        </div>
      )}
    </div>
  );
}

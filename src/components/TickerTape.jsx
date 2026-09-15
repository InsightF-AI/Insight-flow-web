import { useWatchlist } from '../hooks/queries.js';
import { fmtNum, fmtPct } from '../lib/format.js';

function Item({ w, dup }) {
  const alta = w.cotacao.variacao_pct >= 0;
  return (
    <span className="ticker-tape__item" aria-hidden={dup || undefined}>
      <span className={`ticker-tape__dot ${alta ? 'bg-up' : 'bg-down'}`} />
      <strong className="num">{w.ticker}</strong>
      <span className="num">{fmtNum(w.cotacao.preco)}</span>
      <span className={`num font-semibold ${alta ? 'text-up' : 'text-down'}`}>{fmtPct(w.cotacao.variacao_pct)}</span>
    </span>
  );
}

/** Carrossel de cotações da watchlist — cartões deslizando continuamente,
 * estilo pregão. A trilha contém a lista duas vezes seguidas; o CSS anima
 * -50% para o loop ficar contínuo, sem salto no fim. */
export default function TickerTape() {
  const { data: watchlist } = useWatchlist();
  const itens = watchlist ?? [];
  if (itens.length === 0) return null;

  return (
    <div className="ticker-tape" role="marquee" aria-label="Cotações da watchlist">
      <div className="ticker-tape__track">
        {itens.map((w) => (
          <Item key={`a-${w.ticker}`} w={w} />
        ))}
        {itens.map((w) => (
          <Item key={`b-${w.ticker}`} w={w} dup />
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, X } from 'lucide-react';
import { ASSETS, byTicker } from '../api/mock/assets.js';
import { usePositions, useCreateOperation } from '../hooks/queries.js';
import { fmtBRL, fmtNum } from '../lib/format.js';

const hoje = () => new Date().toISOString().slice(0, 10);
const rotulo = (a) => `${a.ticker} — ${a.nome}`;
const vazio = (ticker) => {
  const asset = byTicker(ticker || 'PETR4') ?? ASSETS[0];
  return {
    tipo: 'COMPRA',
    ticker: asset.ticker,
    quantidade: '',
    preco_unitario: String(asset.base),
    data: hoje(),
  };
};

/** Combobox de busca sobre o catálogo de ativos (sem chamada de rede — filtro
 * local em `ASSETS`, o mesmo catálogo usado no restante do app). */
function AtivoCombobox({ ticker, onSelect }) {
  const asset = byTicker(ticker);
  const [busca, setBusca] = useState(asset ? rotulo(asset) : '');
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const a = byTicker(ticker);
    setBusca(a ? rotulo(a) : '');
  }, [ticker]);

  const termo = busca.trim().toLowerCase();
  const opcoes = (
    termo && termo !== (asset ? rotulo(asset).toLowerCase() : '')
      ? ASSETS.filter((a) => a.ticker.toLowerCase().includes(termo) || a.nome.toLowerCase().includes(termo))
      : ASSETS
  ).slice(0, 8);

  const selecionar = (a) => {
    onSelect(a.ticker);
    setBusca(rotulo(a));
    setAberto(false);
  };

  return (
    <div className="relative">
      <label className="label" htmlFor="ativo-busca">Ativo</label>
      <div className="relative">
        <input
          id="ativo-busca"
          className="input pr-9"
          autoComplete="off"
          value={busca}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
        />
        <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-3" />
      </div>
      {aberto && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-sm border border-border-main bg-surface py-1 shadow-lg">
          {opcoes.length === 0 ? (
            <li className="px-3 py-2 text-xs text-fg-3">Nenhum ativo encontrado.</li>
          ) : (
            opcoes.map((a) => (
              <li key={a.ticker}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selecionar(a)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-elevated ${
                    a.ticker === ticker ? 'bg-elevated' : ''
                  }`}
                >
                  <span className="num font-bold text-fg-0">{a.ticker}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-fg-3">{a.nome}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** UC-04 — registrar operação fictícia. `initialTicker` pré-seleciona o ativo
 * quando aberto a partir da tela de detalhe (atalho "Nova operação"). */
export default function OperationModal({ open, onClose, initialTicker }) {
  const [form, setForm] = useState(() => vazio(initialTicker));
  const [erros, setErros] = useState({});
  const [ok, setOk] = useState(false);
  const { data: positions } = usePositions();
  const mut = useCreateOperation();
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (erros[k]) setErros({ ...erros, [k]: undefined });
  };
  const total = (Number(form.quantidade) || 0) * (Number(form.preco_unitario) || 0);
  const asset = byTicker(form.ticker);
  const posicao = (positions ?? []).find((p) => p.ticker === form.ticker);
  const disponivel = posicao?.quantidade ?? 0;

  useEffect(() => {
    if (open) {
      setForm(vazio(initialTicker));
      setErros({});
    }
  }, [open, initialTicker]);

  if (!open) return null;

  const selecionarAtivo = (ticker) => {
    const a = byTicker(ticker);
    setForm({ ...form, ticker, preco_unitario: String(a?.base ?? form.preco_unitario) });
    setErros({ ...erros, ticker: undefined, preco_unitario: undefined });
  };

  const validar = () => {
    const e = {};
    const qtd = Number(form.quantidade);
    const preco = Number(form.preco_unitario);
    if (!form.quantidade || qtd <= 0) e.quantidade = 'Informe uma quantidade maior que zero.';
    else if (form.tipo === 'VENDA' && qtd > disponivel) {
      e.quantidade = `Você tem ${fmtNum(disponivel, asset?.tipo === 'CRIPTO' ? 4 : 0)} em carteira.`;
    }
    if (!form.preco_unitario || preco <= 0) e.preco_unitario = 'Informe um preço maior que zero.';
    if (form.data > hoje()) e.data = 'A data não pode ser futura.';
    return e;
  };

  const submit = (e) => {
    e.preventDefault();
    const validacao = validar();
    setErros(validacao);
    if (Object.keys(validacao).length > 0) return;
    mut.mutate(
      {
        ...form,
        quantidade: Number(form.quantidade),
        preco_unitario: Number(form.preco_unitario),
      },
      {
        onSuccess: () => {
          setOk(true);
          setTimeout(() => {
            setOk(false);
            onClose();
            setForm(vazio(initialTicker));
          }, 1400);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="fade-in w-full max-w-md rounded-xl border border-border-main bg-surface shadow-lg" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border-soft px-5 py-3.5">
          <h3 className="text-sm font-semibold text-fg-0">Nova operação</h3>
          <button onClick={onClose} className="text-fg-3 hover:text-fg-1">
            <X size={16} />
          </button>
        </header>

        {ok ? (
          <div className="grid place-items-center gap-3 px-5 py-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-tone-green-bg">
              <Check size={22} className="text-up" />
            </div>
            <p className="text-sm font-semibold text-fg-0">Operação registrada</p>
            <p className="text-xs text-fg-2">Os agregados da carteira foram recalculados.</p>
          </div>
        ) : (
          <form className="grid gap-4 p-5" onSubmit={submit} noValidate>
            <div className="flex items-start gap-2 rounded-sm border border-tone-orange-bg bg-tone-orange-bg px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
              <p className="text-xs text-warn">
                Operação fictícia — nenhuma ordem é enviada a corretora ou instituição real.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-0.5 rounded-sm bg-elevated p-0.5">
              {['COMPRA', 'VENDA'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: t })}
                  className={`rounded-[6px] py-2 text-sm font-semibold transition-colors ${
                    form.tipo === t
                      ? t === 'COMPRA'
                        ? 'bg-tone-green-bg text-up'
                        : 'bg-tone-red-bg text-down'
                      : 'text-fg-3 hover:text-fg-1'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <AtivoCombobox ticker={form.ticker} onSelect={selecionarAtivo} />
            {form.tipo === 'VENDA' && asset && (
              <p className="-mt-2 text-xs text-fg-3">
                Disponível em carteira: {fmtNum(disponivel, asset.tipo === 'CRIPTO' ? 4 : 0)}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="qtd">Quantidade</label>
                <input
                  id="qtd"
                  className={`input num ${erros.quantidade ? 'border-down' : ''}`}
                  type="number"
                  step="any"
                  min="0"
                  value={form.quantidade}
                  onChange={set('quantidade')}
                />
                {erros.quantidade && <p className="mt-1.5 text-xs text-down">{erros.quantidade}</p>}
              </div>
              <div>
                <label className="label" htmlFor="preco">Preço unitário</label>
                <input
                  id="preco"
                  className={`input num ${erros.preco_unitario ? 'border-down' : ''}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.preco_unitario}
                  onChange={set('preco_unitario')}
                />
                {erros.preco_unitario && <p className="mt-1.5 text-xs text-down">{erros.preco_unitario}</p>}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="data">Data</label>
              <input
                id="data"
                className={`input num ${erros.data ? 'border-down' : ''}`}
                type="date"
                max={hoje()}
                value={form.data}
                onChange={set('data')}
              />
              {erros.data && <p className="mt-1.5 text-xs text-down">{erros.data}</p>}
            </div>

            <div className="flex items-center justify-between rounded-sm border border-border-soft bg-elevated px-3 py-2.5">
              <span className="text-xs uppercase tracking-wider text-fg-3">Valor total</span>
              <span className="num text-lg font-bold text-fg-0">{fmtBRL(total)}</span>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={mut.isPending}>
                {mut.isPending ? 'Registrando…' : 'Registrar operação'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

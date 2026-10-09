import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Copy, ListChecks, Pencil, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { OPERADORES, operadorOf } from '../api/mock/userAlerts.js';
import { useUserRules, useUserTriggers, useUserRuleMutations, useMarkTriggersSeen, useWatchlist } from '../hooks/queries.js';
import { Card, Pill, Skeleton, Empty, ErrorState, SectionTitle } from '../components/ui.jsx';
import { fmtBRL, fmtNum, sinceNow } from '../lib/format.js';

const VAZIO = { ticker: '', operador: 'GTE', valor: '' };

/** Alertas de preço do usuário (POST /alertas). O backend avalia a condição a cada ciclo do
 * scheduler e entrega o disparo em tempo real pelo WebSocket de notificações. */
export default function MyAlerts() {
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [editandoId, setEditandoId] = useState(null);
  const { data: regras, isLoading, isError: erroRegras, refetch: refazerRegras } = useUserRules();
  const { data: disparos, isLoading: carregandoDisparos, isError: erroDisparos, refetch: refazerDisparos } = useUserTriggers();
  const { create, update, toggle, remove } = useUserRuleMutations();
  const marcarVistos = useMarkTriggersSeen();
  // a API só aceita alerta para ativo já conhecido — a lista vem da watchlist.
  const { data: watchlist } = useWatchlist();
  const ticker = form.ticker || watchlist?.[0]?.ticker || '';
  const ativoSelecionado = (watchlist ?? []).find((w) => w.ticker === ticker);

  useEffect(() => {
    if ((disparos ?? []).some((d) => !d.visto)) marcarVistos.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disparos]);
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (erros[k]) setErros({ ...erros, [k]: undefined });
  };

  const validar = () => {
    const e = {};
    if (!ticker) e.ticker = 'Adicione um ativo à watchlist antes de criar um alerta.';
    if (!form.valor || !(Number(form.valor) > 0)) e.valor = 'Informe um valor-alvo maior que zero.';
    return e;
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setForm(VAZIO);
    setErros({});
  };

  const submit = (e) => {
    e.preventDefault();
    const validacao = validar();
    setErros(validacao);
    if (Object.keys(validacao).length > 0) return;
    const payload = { ...form, ticker, valor: Number(form.valor) };
    if (editandoId) {
      update.mutate({ id: editandoId, patch: payload }, { onSuccess: cancelarEdicao });
    } else {
      create.mutate(payload, { onSuccess: () => setForm({ ...VAZIO, ticker }) });
    }
  };

  const carregarForm = (r) => ({ ticker: r.ticker, operador: r.operador, valor: String(r.valor) });

  const duplicar = (r) => {
    setEditandoId(null);
    setForm(carregarForm(r));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const editar = (r) => {
    setEditandoId(r.id);
    setErros({});
    setForm(carregarForm(r));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ativos = (regras ?? []).filter((r) => r.ativa);
  const atingidas = ativos.filter((r) => r.avaliacao.atingido);

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      <header>
        <h2 className="text-2xl font-bold">Meus alertas</h2>
        <p className="mt-1">
          Defina um preço-alvo por ativo — o aviso chega em tempo real quando o preço cruzar o alvo.{' '}
          {ativos.length} regras ativas, {atingidas.length} com a condição satisfeita agora.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr] xl:items-start">
        <Card title={<SectionTitle icon={SlidersHorizontal}>{editandoId ? 'Editar regra' : 'Nova regra'}</SectionTitle>}>
          <form className="grid gap-4" onSubmit={submit}>
            <div>
              <label className="label" htmlFor="ua-ativo">Ativo</label>
              <select id="ua-ativo" className="input" value={ticker} onChange={set('ticker')} disabled={editandoId != null}>
                {(watchlist ?? []).map((a) => (
                  <option key={a.ticker} value={a.ticker}>
                    {a.ticker} — {a.nome}
                  </option>
                ))}
              </select>
              {ativoSelecionado?.cotacao && (
                <p className="mt-1.5 text-xs text-fg-3">
                  Preço atual{' '}
                  <span className="num font-semibold text-fg-1">{fmtBRL(ativoSelecionado.cotacao.preco, ativoSelecionado.moeda)}</span>
                </p>
              )}
              {erros.ticker && <p className="mt-1.5 text-xs text-down">{erros.ticker}</p>}
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <label className="label" htmlFor="ua-op">Quando o preço</label>
                <select id="ua-op" className="input" value={form.operador} onChange={set('operador')}>
                  {OPERADORES.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ua-valor">
                  Valor {ativoSelecionado ? `(${ativoSelecionado.moeda})` : ''}
                </label>
                <input
                  id="ua-valor"
                  className={`input num ${erros.valor ? 'border-down' : ''}`}
                  type="number"
                  step="any"
                  min="0"
                  value={form.valor}
                  onChange={set('valor')}
                />
              </div>
            </div>
            {erros.valor && <p className="-mt-2 text-xs text-down">{erros.valor}</p>}

            <div className="rounded-sm border border-border-soft bg-elevated px-3 py-2.5 text-xs text-fg-2">
              Notificar quando <span className="num font-semibold text-fg-0">{ticker || '—'}</span> tiver preço{' '}
              {operadorOf(form.operador).simbolo}{' '}
              <span className="num font-semibold text-fg-0">
                {ativoSelecionado ? fmtBRL(Number(form.valor) || 0, ativoSelecionado.moeda) : form.valor || '—'}
              </span>
              . Verificado pelo servidor a cada ciclo do agendador.
              {editandoId && (
                <p className="mt-1.5 text-fg-3">
                  Ao salvar, a regra é rearmada — mesmo que a condição já esteja satisfeita, não dispara na hora.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {editandoId && (
                <button type="button" className="btn-ghost flex-1" onClick={cancelarEdicao}>
                  <X size={15} /> Cancelar
                </button>
              )}
              <button className="btn-primary flex-1" disabled={create.isPending || update.isPending}>
                {editandoId
                  ? update.isPending
                    ? 'Salvando…'
                    : 'Salvar alterações'
                  : create.isPending
                    ? 'Criando regra…'
                    : <><Plus size={15} /> Criar alerta</>}
              </button>
            </div>
          </form>
        </Card>

        <div className="grid gap-6">
          <Card title={<SectionTitle icon={ListChecks}>Regras</SectionTitle>} bodyClass="p-0">
            {isLoading ? (
              <div className="grid gap-3 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : erroRegras ? (
              <ErrorState onRetry={refazerRegras} />
            ) : (regras ?? []).length === 0 ? (
              <Empty
                action={
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    Criar meu primeiro alerta
                  </button>
                }
              >
                Nenhuma regra criada.
              </Empty>
            ) : (
              <ul>
                {regras.map((r) => (
                  <li
                    key={r.id}
                    className={`border-b border-border-soft p-4 last:border-0 ${r.ativa ? '' : 'opacity-55'} ${
                      editandoId === r.id ? 'bg-elevated ring-1 ring-inset ring-accent' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/ativo/${r.ticker}`} className="num text-sm font-bold">
                        {r.ticker}
                      </Link>
                      <span className="text-sm text-fg-1">{r.avaliacao.condicao}</span>
                      {editandoId === r.id ? (
                        <Pill tone="blue">editando</Pill>
                      ) : r.avaliacao.atingido && r.ativa ? (
                        <Pill tone="green">condição satisfeita</Pill>
                      ) : (
                        <Pill tone="slate">{r.ativa ? 'aguardando' : 'pausada'}</Pill>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => toggle.mutate(r.id)}
                          className="rounded-sm border border-border-main px-2 py-1 text-xs font-semibold text-fg-2 hover:bg-muted"
                        >
                          {r.ativa ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => editar(r)}
                          title="Editar regra"
                          className="rounded-sm p-1.5 text-fg-3 hover:bg-muted hover:text-accent"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => duplicar(r)}
                          title="Duplicar regra"
                          className="rounded-sm p-1.5 text-fg-3 hover:bg-muted hover:text-accent"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => remove.mutate(r.id)}
                          title="Excluir regra"
                          className="rounded-sm p-1.5 text-fg-3 hover:bg-muted hover:text-down"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-fg-2">
                      <span>
                        Valor atual <span className="num font-semibold text-fg-0">{r.avaliacao.valor_atual_label}</span>
                      </span>
                      <span>
                        Alvo <span className="num font-semibold text-fg-0">{r.avaliacao.alvo_label}</span>
                      </span>
                      {r.disparado_em && <span>Disparado há {sinceNow(r.disparado_em)}</span>}
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${fmtNum(Math.min(r.avaliacao.progresso, 100), 0).replace(',', '.')}%`,
                          background: r.avaliacao.atingido ? 'var(--up)' : 'var(--accent)',
                        }}
                      />
                    </div>

                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={<SectionTitle icon={BellRing}>Disparos recentes</SectionTitle>}
            bodyClass="p-0"
          >
            {carregandoDisparos ? (
              <div className="grid gap-3 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : erroDisparos ? (
              <ErrorState onRetry={refazerDisparos} />
            ) : (disparos ?? []).length === 0 ? (
              <Empty>Nenhum disparo registrado.</Empty>
            ) : (
              <ul>
                {disparos.map((d) => (
                  <li key={d.id} className="flex items-start gap-3 border-b border-border-soft px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <span className="num text-sm font-bold text-fg-0">{d.ticker}</span>
                      <p className="mt-1">{d.texto}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {d.canais.map((c) => {
                          const status = d.entrega?.[c] ?? 'simulado';
                          const label = 'Tempo real';
                          const tone = status === 'entregue' ? 'green' : status === 'indisponivel' ? 'red' : 'slate';
                          const statusLabel = status === 'entregue' ? 'entregue' : status === 'indisponivel' ? 'indisponível' : 'simulado';
                          return (
                            <Pill key={c} tone={tone}>
                              {label} · {statusLabel}
                            </Pill>
                          );
                        })}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-fg-3">há {sinceNow(d.data)}</span>
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

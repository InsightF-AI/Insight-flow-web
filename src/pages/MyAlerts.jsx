import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Check, Copy, ListChecks, Pencil, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { ASSETS, byTicker } from '../api/mock/assets.js';
import { METRICAS, OPERADORES, CANAIS, FREQUENCIAS, metricaOf, operadorOf } from '../api/mock/userAlerts.js';
import { useUserRules, useUserTriggers, useUserRuleMutations, useMarkTriggersSeen } from '../hooks/queries.js';
import { Card, Pill, Skeleton, Empty, ErrorState, SectionTitle } from '../components/ui.jsx';
import { fmtBRL, fmtNum, sinceNow } from '../lib/format.js';

const VAZIO = { ticker: 'BTC', metrica: 'PRECO', operador: 'GTE', valor: '', canais: ['PUSH'], frequencia: 'UMA_VEZ', nota: '' };

/** Alertas definidos pelo usuário: condição sobre indicadores + canais de entrega. */
export default function MyAlerts() {
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [editandoId, setEditandoId] = useState(null);
  const { data: regras, isLoading, isError: erroRegras, refetch: refazerRegras } = useUserRules();
  const { data: disparos, isLoading: carregandoDisparos, isError: erroDisparos, refetch: refazerDisparos } = useUserTriggers();
  const { create, update, toggle, remove } = useUserRuleMutations();
  const marcarVistos = useMarkTriggersSeen();

  useEffect(() => {
    if ((disparos ?? []).some((d) => !d.visto)) marcarVistos.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disparos]);
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (erros[k]) setErros({ ...erros, [k]: undefined });
  };
  const metrica = metricaOf(form.metrica);
  const ativoSelecionado = byTicker(form.ticker);

  const toggleCanal = (id) => {
    setForm({ ...form, canais: form.canais.includes(id) ? form.canais.filter((c) => c !== id) : [...form.canais, id] });
    if (erros.canais) setErros({ ...erros, canais: undefined });
  };

  const validar = () => {
    const e = {};
    if (!form.valor || !(Number(form.valor) > 0)) e.valor = 'Informe um valor-alvo maior que zero.';
    if (form.canais.length === 0) e.canais = 'Selecione ao menos um canal de entrega.';
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
    const payload = { ...form, valor: Number(form.valor) };
    if (editandoId) {
      update.mutate({ id: editandoId, patch: payload }, { onSuccess: cancelarEdicao });
    } else {
      create.mutate(payload, { onSuccess: () => setForm({ ...VAZIO, ticker: form.ticker }) });
    }
  };

  const carregarForm = (r) => ({
    ticker: r.ticker,
    metrica: r.metrica,
    operador: r.operador,
    valor: String(r.valor),
    canais: [...r.canais],
    frequencia: r.frequencia,
    nota: r.nota ?? '',
  });

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
          Defina a condição por ativo e os canais de entrega. {ativos.length} regras ativas, {atingidas.length} com a
          condição satisfeita agora.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr] xl:items-start">
        <Card title={<SectionTitle icon={SlidersHorizontal}>{editandoId ? 'Editar regra' : 'Nova regra'}</SectionTitle>}>
          <form className="grid gap-4" onSubmit={submit}>
            <div>
              <label className="label" htmlFor="ua-ativo">Ativo</label>
              <select id="ua-ativo" className="input" value={form.ticker} onChange={set('ticker')}>
                {ASSETS.map((a) => (
                  <option key={a.ticker} value={a.ticker}>
                    {a.ticker} — {a.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="ua-metrica">Indicador</label>
              <select id="ua-metrica" className="input" value={form.metrica} onChange={set('metrica')}>
                {METRICAS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-fg-3">{metrica.dica}</p>
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <label className="label" htmlFor="ua-op">Condição</label>
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
                  Valor {metrica.unidade === 'moeda' && ativoSelecionado ? `(${ativoSelecionado.moeda})` : ''}
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

            <div>
              <span className="label">Canais de entrega</span>
              <div className="flex flex-wrap gap-2">
                {CANAIS.map((c) => {
                  const on = form.canais.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCanal(c.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        on ? 'border-accent text-accent' : 'border-border-main text-fg-3'
                      }`}
                    >
                      {on && <Check size={12} className="mr-1 inline" />}
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {erros.canais && <p className="mt-1.5 text-xs text-down">{erros.canais}</p>}
            </div>

            <div>
              <label className="label" htmlFor="ua-freq">Frequência</label>
              <select id="ua-freq" className="input" value={form.frequencia} onChange={set('frequencia')}>
                {FREQUENCIAS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="ua-nota">Nota (opcional)</label>
              <input id="ua-nota" className="input" placeholder="Ex: zona de recompra" value={form.nota} onChange={set('nota')} />
            </div>

            <div className="rounded-sm border border-border-soft bg-elevated px-3 py-2.5 text-xs text-fg-2">
              Notificar quando <span className="num font-semibold text-fg-0">{form.ticker}</span> tiver{' '}
              {metrica.label.toLowerCase()} {operadorOf(form.operador).simbolo}{' '}
              <span className="num font-semibold text-fg-0">
                {metrica.unidade === 'moeda' && ativoSelecionado ? fmtBRL(Number(form.valor) || 0, ativoSelecionado.moeda) : form.valor || '—'}
              </span>
              {metrica.unidade && metrica.unidade !== 'moeda' ? metrica.unidade : ''} em{' '}
              {form.canais.length} canal(is).
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
                      <span>{FREQUENCIAS.find((f) => f.id === r.frequencia)?.label}</span>
                      <span>{r.canais.map((c) => CANAIS.find((x) => x.id === c)?.label).join(' · ')}</span>
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

                    {r.nota && <p className="mt-2 text-xs text-fg-3">{r.nota}</p>}
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
                          const label = CANAIS.find((x) => x.id === c)?.label ?? c;
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

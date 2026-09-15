import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellOff,
  Bug,
  Download,
  Info,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Shield,
  Smartphone,
  Sun,
  User,
} from 'lucide-react';
import { useAuthStore, useUiStore } from '../store/index.js';
import { useWatchlist, useWatchlistMutations, usePositions, useOperations, useSessions, useAccountMutations } from '../hooks/queries.js';
import { Card, Pill, SectionTitle, Skeleton, Empty, ErrorState } from './ui.jsx';
import { fmtDate, sinceNow } from '../lib/format.js';

function Toggle({ label, hint, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-soft py-3.5 last:border-0">
      <div>
        <div className="text-sm font-medium text-fg-1">{label}</div>
        {hint && <p className="mt-0.5 text-xs text-fg-3">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? 'bg-accent' : 'bg-muted'}`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

function PerfilCard() {
  const { usuario, updateUsuario } = useAuthStore();
  const { updateProfile } = useAccountMutations();
  const [form, setForm] = useState({ nome: usuario?.nome ?? '', email: usuario?.email ?? '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const inicial = (usuario?.nome ?? 'U').charAt(0).toUpperCase();

  const submit = (e) => {
    e.preventDefault();
    updateProfile.mutate(form, { onSuccess: (d) => updateUsuario(d) });
  };

  return (
    <Card title={<SectionTitle icon={User}>Perfil</SectionTitle>}>
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent text-xl font-bold text-base">
          {inicial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg-0">{usuario?.nome}</div>
          <div className="truncate text-xs text-fg-3">{usuario?.email}</div>
        </div>
      </div>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="perfil-nome">Nome</label>
          <input id="perfil-nome" className="input" value={form.nome} onChange={set('nome')} required />
        </div>
        <div>
          <label className="label" htmlFor="perfil-email">E-mail</label>
          <input id="perfil-email" className="input" type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className="btn-primary" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Salvando…' : 'Salvar alterações'}
          </button>
          {updateProfile.isSuccess && (
            <span className="fade-in text-xs font-semibold text-up">Perfil atualizado.</span>
          )}
          {updateProfile.isError && <span className="text-xs text-down">{updateProfile.error.message}</span>}
        </div>
      </form>
    </Card>
  );
}

function AparenciaCard() {
  const { tema, setTema, sidebarOpen, toggleSidebar } = useUiStore();
  return (
    <Card title={<SectionTitle icon={Palette} tone="purple">Aparência</SectionTitle>}>
      <div className="flex items-center justify-between gap-4 border-b border-border-soft py-3.5">
        <div>
          <div className="text-sm font-medium text-fg-1">Tema</div>
          <p className="mt-0.5 text-xs text-fg-3">Aplica em toda a interface, inclusive nos gráficos.</p>
        </div>
        <div className="flex gap-0.5 rounded-sm bg-elevated p-0.5">
          <button
            onClick={() => setTema('escuro')}
            className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold ${
              tema !== 'claro' ? 'bg-muted text-fg-0 shadow-sm' : 'text-fg-3 hover:text-fg-1'
            }`}
          >
            <Moon size={13} /> Escuro
          </button>
          <button
            onClick={() => setTema('claro')}
            className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold ${
              tema === 'claro' ? 'bg-muted text-fg-0 shadow-sm' : 'text-fg-3 hover:text-fg-1'
            }`}
          >
            <Sun size={13} /> Claro
          </button>
        </div>
      </div>
      <Toggle
        label="Menu lateral sempre expandido"
        hint="Mantém os rótulos de navegação visíveis no desktop."
        value={sidebarOpen}
        onChange={toggleSidebar}
      />
    </Card>
  );
}

function SegurancaCard() {
  const { changePassword, revokeSession, revokeOtherSessions } = useAccountMutations();
  const { data: sessions, isLoading, isError, refetch } = useSessions();
  const [form, setForm] = useState({ atual: '', nova: '', confirmar: '' });
  const [erroLocal, setErroLocal] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    setErroLocal('');
    if (form.nova !== form.confirmar) {
      setErroLocal('A confirmação não coincide com a nova senha.');
      return;
    }
    changePassword.mutate(
      { atual: form.atual, nova: form.nova },
      { onSuccess: () => setForm({ atual: '', nova: '', confirmar: '' }) },
    );
  };

  const erro = erroLocal || changePassword.error?.message;
  const outras = (sessions ?? []).filter((s) => !s.atual);

  return (
    <Card title={<SectionTitle icon={Shield}>Segurança</SectionTitle>}>
      <form className="grid gap-4 border-b border-border-soft pb-5 sm:grid-cols-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="senha-atual">Senha atual</label>
          <input id="senha-atual" className="input" type="password" value={form.atual} onChange={set('atual')} required />
        </div>
        <div>
          <label className="label" htmlFor="senha-nova">Nova senha</label>
          <input id="senha-nova" className="input" type="password" minLength={8} value={form.nova} onChange={set('nova')} required />
        </div>
        <div>
          <label className="label" htmlFor="senha-conf">Confirmar nova senha</label>
          <input id="senha-conf" className="input" type="password" value={form.confirmar} onChange={set('confirmar')} required />
        </div>
        <div className="flex items-center gap-3 sm:col-span-3">
          <button className="btn-primary" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Atualizando…' : 'Atualizar senha'}
          </button>
          {changePassword.isSuccess && !erro && (
            <span className="fade-in text-xs font-semibold text-up">Senha atualizada.</span>
          )}
          {erro && <span className="text-xs text-down">{erro}</span>}
        </div>
      </form>

      <div className="pt-4">
        <h4 className="mb-1 text-sm font-semibold text-fg-1">Sessões ativas</h4>
        <p className="mb-3 text-xs text-fg-3">Dispositivos conectados à sua conta nesta versão de demonstração.</p>
        {isLoading ? (
          <div className="grid gap-2">
            <Skeleton className="h-12" /> <Skeleton className="h-12" />
          </div>
        ) : isError ? (
          <ErrorState message="Não foi possível carregar as sessões." onRetry={refetch} />
        ) : (
          <ul>
            {(sessions ?? []).map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-border-soft py-3 last:border-0">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-elevated text-fg-2">
                  {s.dispositivo.toLowerCase().includes('iphone') || s.dispositivo.toLowerCase().includes('app') ? (
                    <Smartphone size={16} />
                  ) : (
                    <Monitor size={16} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-fg-1">
                    {s.dispositivo}
                    {s.atual && <Pill tone="green">Sessão atual</Pill>}
                  </div>
                  <div className="text-xs text-fg-3">
                    {s.local} · último acesso há {sinceNow(s.ultimo_acesso)}
                  </div>
                </div>
                {!s.atual && (
                  <button
                    onClick={() => revokeSession.mutate(s.id)}
                    className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
                  >
                    Encerrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {outras.length > 0 && (
          <button
            onClick={() => revokeOtherSessions.mutate()}
            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-down"
          >
            <LogOut size={13} /> Encerrar todas as outras sessões
          </button>
        )}
      </div>
    </Card>
  );
}

function DadosCard({ usuario, watchlist, posicoes, operacoes }) {
  const exportar = () => {
    const payload = {
      usuario: usuario ? { nome: usuario.nome, email: usuario.email } : null,
      watchlist: watchlist ?? [],
      posicoes: posicoes ?? [],
      operacoes: operacoes ?? [],
      gerado_em: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'insightflow-meus-dados.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card title={<SectionTitle icon={Download} tone="amber">Seus dados</SectionTitle>}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-fg-1">Exportar meus dados</div>
          <p className="mt-0.5 text-xs text-fg-3">
            Baixa um arquivo JSON com watchlist, posições e operações registradas nesta demonstração.
          </p>
        </div>
        <button onClick={exportar} className="btn-ghost">
          <Download size={15} /> Exportar (.json)
        </button>
      </div>
    </Card>
  );
}

/** Conteúdo de Configurações — usado tanto na rota /configuracoes quanto no modal. */
export default function SettingsPanel() {
  const { usuario } = useAuthStore();
  const {
    notificacoesPush,
    notificacoesEmail,
    notificacoesMobile,
    notificacoesDesktop,
    resumoDiario,
    iaIndisponivel,
    forcarErro,
    setFlag,
  } = useUiStore();
  const { data: watchlist, isLoading: carregandoWatchlist, isError: erroWatchlist, refetch: refazerWatchlist } = useWatchlist();
  const { data: posicoes } = usePositions();
  const { data: operacoes } = useOperations();
  const { toggle } = useWatchlistMutations();
  const [permissaoNegada, setPermissaoNegada] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'denied',
  );

  /** RF-18/UC-05 — a primeira vez que o usuário liga o web push, o navegador precisa
   * conceder permissão de notificação; se negar, o toggle não liga e um aviso explica. */
  const alternarWebPush = async (ligar) => {
    if (!ligar) return setFlag('notificacoesPush', false);
    if (typeof Notification === 'undefined') return setPermissaoNegada(true);
    if (Notification.permission === 'granted') return setFlag('notificacoesPush', true);
    const resultado = await Notification.requestPermission();
    setPermissaoNegada(resultado !== 'granted');
    setFlag('notificacoesPush', resultado === 'granted');
  };

  return (
    <div className="grid gap-6">
      <PerfilCard />
      <AparenciaCard />
      <SegurancaCard />

      <Card title={<SectionTitle icon={Bell}>Notificações</SectionTitle>}>
        <Toggle
          label="Web push"
          hint="Alertas de sinal técnico entregues no navegador. Pede permissão do navegador na primeira vez."
          value={notificacoesPush}
          onChange={alternarWebPush}
        />
        {permissaoNegada && (
          <p className="-mt-2 pb-3.5 text-xs text-down">
            Permissão de notificação negada pelo navegador. Habilite manualmente nas configurações do site para
            receber web push.
          </p>
        )}
        <Toggle
          label="E-mail"
          hint="Resumo de sinais e disparos de alerta por e-mail."
          value={notificacoesEmail}
          onChange={(v) => setFlag('notificacoesEmail', v)}
        />
        <Toggle
          label="Notificação mobile"
          hint="Push no aplicativo, quando instalado."
          value={notificacoesMobile}
          onChange={(v) => setFlag('notificacoesMobile', v)}
        />
        <Toggle
          label="Bandeja do Windows"
          hint="Notificações nativas do sistema operacional."
          value={notificacoesDesktop}
          onChange={(v) => setFlag('notificacoesDesktop', v)}
        />
        <Toggle
          label="Resumo diário"
          hint="Resumo textual da carteira como primeira notificação do dia."
          value={resumoDiario}
          onChange={(v) => setFlag('resumoDiario', v)}
        />
      </Card>

      <Card title={<SectionTitle icon={Bell} tone="blue">Notificações por ativo</SectionTitle>} bodyClass="p-0">
        {carregandoWatchlist ? (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-12" /> <Skeleton className="h-12" />
          </div>
        ) : erroWatchlist ? (
          <ErrorState message="Não foi possível carregar a watchlist." onRetry={refazerWatchlist} />
        ) : (watchlist ?? []).length === 0 ? (
          <Empty action={<Link to="/busca" className="btn-ghost px-3 py-1.5 text-xs">Buscar ativos</Link>}>
            Nenhum ativo na watchlist.
          </Empty>
        ) : (
          <ul>
            {watchlist.map((w) => (
              <li key={w.ticker} className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <span className="num text-sm font-bold text-fg-0">{w.ticker}</span>
                  <div className="truncate text-xs text-fg-2">Adicionado em {fmtDate(w.adicionado_em)}</div>
                </div>
                <button
                  onClick={() => toggle.mutate(w.ticker)}
                  className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-semibold ${
                    w.notificar ? 'border-accent text-accent' : 'border-border-main text-fg-3'
                  }`}
                >
                  {w.notificar ? <Bell size={13} /> : <BellOff size={13} />}
                  {w.notificar ? 'Ativas' : 'Desativadas'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DadosCard usuario={usuario} watchlist={watchlist} posicoes={posicoes} operacoes={operacoes} />

      <Card title={<SectionTitle icon={Bug} tone="amber">Modo desenvolvedor</SectionTitle>}>
        <Toggle
          label="Simular IA indisponível"
          hint="UC-03 (fluxo alternativo): a análise por ativo e o resumo diário passam a sinalizar indisponibilidade, sem quebrar a tela — os dados numéricos continuam aparecendo normalmente."
          value={iaIndisponivel}
          onChange={(v) => setFlag('iaIndisponivel', v)}
        />
        <Toggle
          label="Forçar erro de carregamento"
          hint="RNF-10: as consultas de leitura (watchlist, portfólio, rankings, alertas etc.) passam a falhar, para demonstrar o estado de erro com nova tentativa em cada tela. Ações de escrita (login, criar operação/alerta) não são afetadas."
          value={forcarErro}
          onChange={(v) => setFlag('forcarErro', v)}
        />
      </Card>

      <Card title={<SectionTitle icon={Info}>Sobre esta versão</SectionTitle>}>
        <p>
          Cliente web em React + Vite consumindo uma camada de dados mockada em memória. Todos os indicadores são
          calculados no navegador a partir de séries OHLCV sintéticas e determinísticas. Nenhuma operação real é
          executada e nenhuma chamada a provedor de IA é feita.
        </p>
      </Card>
    </div>
  );
}

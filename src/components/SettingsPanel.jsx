import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, Bug, Download, Info, Moon, Palette, Sun, User } from 'lucide-react';
import { useAuthStore, useUiStore } from '../store/index.js';
import { useWatchlist, useWatchlistMutations, usePositions, useOperations } from '../hooks/queries.js';
import { Card, SectionTitle, Skeleton, Empty, ErrorState } from './ui.jsx';
import { fmtDate } from '../lib/format.js';
import { ativarWebPush, desativarWebPush } from '../lib/webPush.js';

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

/** A API ainda não tem rota para alterar nome, e-mail ou senha — o card só mostra a conta. */
function PerfilCard() {
  const { usuario } = useAuthStore();
  const inicial = (usuario?.nome ?? 'U').charAt(0).toUpperCase();

  return (
    <Card title={<SectionTitle icon={User}>Perfil</SectionTitle>}>
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent text-xl font-bold text-base">
          {inicial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg-0">{usuario?.nome}</div>
          <div className="truncate text-xs text-fg-3">{usuario?.email}</div>
        </div>
      </div>
      <p className="mt-4 text-xs text-fg-3">
        Alterar nome, e-mail ou senha ainda não está disponível nesta versão.
      </p>
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
            Baixa um arquivo JSON com sua watchlist, posições e operações registradas.
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
    iaIndisponivel,
    forcarErro,
    setFlag,
  } = useUiStore();
  const { data: watchlist, isLoading: carregandoWatchlist, isError: erroWatchlist, refetch: refazerWatchlist } = useWatchlist();
  const { data: posicoes } = usePositions();
  const { data: operacoes } = useOperations();
  const { toggle } = useWatchlistMutations();
  const [erroWebPush, setErroWebPush] = useState(null);
  const [permissaoNegada, setPermissaoNegada] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'denied',
  );

  /** RF-18/UC-05 — a primeira vez que o usuário liga o web push, o navegador precisa
   * conceder permissão de notificação; se negar, o toggle não liga e um aviso explica. */
  const alternarWebPush = async (ligar) => {
    setErroWebPush(null);
    if (!ligar) {
      setFlag('notificacoesPush', false);
      setFlag('webPushAtivo', false);
      return desativarWebPush();
    }
    if (typeof Notification === 'undefined') return setPermissaoNegada(true);
    const resultado = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    setPermissaoNegada(resultado !== 'granted');
    setFlag('notificacoesPush', resultado === 'granted');
    if (resultado !== 'granted') return undefined;
    try {
      await ativarWebPush();
      setFlag('webPushAtivo', true);
    } catch (err) {
      // sem inscrição no servidor, ainda há o toast/notificação via WebSocket com o app aberto.
      setFlag('webPushAtivo', false);
      setErroWebPush(err.message);
    }
    return undefined;
  };

  return (
    <div className="grid gap-6">
      <PerfilCard />
      <AparenciaCard />

      <Card title={<SectionTitle icon={Bell}>Notificações</SectionTitle>}>
        <Toggle
          label="Web push"
          hint="Alertas e sinais entregues pelo servidor no navegador, mesmo com a aba fechada. Pede permissão na primeira vez."
          value={notificacoesPush}
          onChange={alternarWebPush}
        />
        {permissaoNegada && (
          <p className="-mt-2 pb-3.5 text-xs text-down">
            Permissão de notificação negada pelo navegador. Habilite manualmente nas configurações do site para
            receber web push.
          </p>
        )}
        {erroWebPush && (
          <p className="-mt-2 pb-3.5 text-xs text-down">Não foi possível ativar o web push no servidor: {erroWebPush}</p>
        )}
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

      {/* só em `npm run dev`: num build publicado os alternadores não têm efeito (ver apiFetch). */}
      {import.meta.env.DEV && (
        <Card title={<SectionTitle icon={Bug} tone="amber">Modo desenvolvedor</SectionTitle>}>
          <Toggle
            label="Simular IA indisponível"
            hint="UC-03 (fluxo alternativo): a análise por ativo e o resumo diário passam a sinalizar indisponibilidade, sem quebrar a tela — os dados numéricos continuam aparecendo normalmente."
            value={iaIndisponivel}
            onChange={(v) => setFlag('iaIndisponivel', v)}
          />
          <Toggle
            label="Forçar erro de carregamento"
            hint="RNF-10: as consultas de leitura (watchlist, portfólio, alertas etc.) passam a falhar, para demonstrar o estado de erro com nova tentativa em cada tela. Ações de escrita (login, criar operação/alerta) não são afetadas."
            value={forcarErro}
            onChange={(v) => setFlag('forcarErro', v)}
          />
        </Card>
      )}

      <Card title={<SectionTitle icon={Info}>Sobre esta versão</SectionTitle>}>
        <p>
          Cliente web em React + Vite integrado à API do InsightFlow: watchlist, cotações, histórico, indicadores,
          sinais, alertas, carteira simulada, notificações e IA vêm do servidor; os rankings são montados com os
          ativos da sua watchlist. Rankings de mercado, notícias e o score de oportunidade ficam de fora até a API
          ter essas rotas. Nenhuma ordem real é enviada a corretora.
        </p>
      </Card>
    </div>
  );
}

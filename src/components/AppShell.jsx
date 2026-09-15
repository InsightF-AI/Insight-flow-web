import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  BellRing,
  ChevronDown,
  GitCompare,
  LayoutDashboard,
  MessageSquare,
  Moon,
  PieChart,
  Search,
  Settings,
  LogOut,
  Menu,
  Sun,
  Trophy,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuthStore, useUiStore } from '../store/index.js';
import { useAlerts, useUserTriggers } from '../hooks/queries.js';
import SearchDialog from './SearchDialog.jsx';
import SettingsModal from './SettingsModal.jsx';
import TickerTape from './TickerTape.jsx';

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/portfolio', label: 'Portfólio', icon: PieChart },
      { to: '/rankings', label: 'Rankings', icon: Trophy },
      { to: '/comparar', label: 'Comparador', icon: GitCompare },
    ],
  },
  {
    label: 'Alertas',
    items: [
      { to: '/alertas', label: 'Alertas', icon: Bell },
      { to: '/meus-alertas', label: 'Meus alertas', icon: BellRing },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { to: '/chat', label: 'Chat IA', icon: MessageSquare },
      { to: '/busca', label: 'Buscar ativos', icon: Search },
      { action: 'settings', label: 'Configurações', icon: Settings },
    ],
  },
];

function ProfilePopover({ collapsed, usuario, naoLidos, naoVistos, tema, setTema, onNavigate, onOpenSettings, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    onNavigate();
  };

  const item = (to, Icon, label, extra) => (
    <Link to={to} onClick={close} className="flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-fg-1 hover:bg-elevated">
      <Icon size={16} className="shrink-0 text-fg-3" />
      <span className="flex-1">{label}</span>
      {extra}
    </Link>
  );

  return (
    <div className="relative mb-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-elevated ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-base">
          {usuario?.nome?.[0]?.toUpperCase() ?? 'U'}
          {naoLidos + naoVistos > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-down" />
          )}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium text-fg-1">{usuario?.nome}</span>
              <span className="block truncate text-[11px] text-fg-3">{usuario?.email}</span>
            </span>
            <ChevronDown size={14} className={`shrink-0 text-fg-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {open && (
        <div
          className={`fade-in absolute z-50 w-64 overflow-hidden rounded-xl border border-border-main bg-surface shadow-lg ${
            collapsed ? 'bottom-0 left-full ml-2' : 'bottom-full left-0 mb-2'
          }`}
        >
          <div className="border-b border-border-soft px-4 py-3">
            <div className="truncate text-sm font-semibold text-fg-0">{usuario?.nome}</div>
            <div className="truncate text-xs text-fg-3">{usuario?.email}</div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-2.5">
            <span className="text-xs font-medium text-fg-2">Tema</span>
            <div className="flex gap-0.5 rounded-sm bg-elevated p-0.5">
              <button
                onClick={() => setTema('escuro')}
                className={`flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs font-semibold ${
                  tema !== 'claro' ? 'bg-muted text-fg-0 shadow-sm' : 'text-fg-3 hover:text-fg-1'
                }`}
              >
                <Moon size={12} /> Escuro
              </button>
              <button
                onClick={() => setTema('claro')}
                className={`flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs font-semibold ${
                  tema === 'claro' ? 'bg-muted text-fg-0 shadow-sm' : 'text-fg-3 hover:text-fg-1'
                }`}
              >
                <Sun size={12} /> Claro
              </button>
            </div>
          </div>

          <div className="py-1">
            {item(
              '/alertas',
              Bell,
              'Alertas',
              naoLidos > 0 && (
                <span className="rounded-full bg-down px-1.5 text-[11px] font-bold text-white">{naoLidos}</span>
              ),
            )}
            {item(
              '/meus-alertas',
              BellRing,
              'Meus alertas',
              naoVistos > 0 && (
                <span className="rounded-full bg-down px-1.5 text-[11px] font-bold text-white">{naoVistos}</span>
              ),
            )}
            {item('/chat', MessageSquare, 'Chat IA')}
            <button
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
              className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-fg-1 hover:bg-elevated"
            >
              <Settings size={16} className="shrink-0 text-fg-3" />
              <span className="flex-1 text-left">Configurações</span>
            </button>
          </div>

          <div className="border-t border-border-soft py-1">
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-down hover:bg-elevated"
            >
              <LogOut size={16} className="shrink-0" />
              <span className="flex-1 text-left">Sair</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ collapsed, usuario, naoLidos, naoVistos, tema, setTema, onNavigate, onSignOut, onToggleCollapse, onOpenSettings }) {
  return (
    <>
      <div className={`flex h-16 shrink-0 items-center gap-2.5 px-4 ${collapsed ? 'justify-center px-0' : ''}`}>
        <img src="/icone.png" alt="" className="h-8 w-8 shrink-0" />
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-display text-sm font-bold text-fg-0">InsightFlow</div>
            <div className="text-[10px] uppercase tracking-widest text-fg-3">B3 · Cripto</div>
          </div>
        )}
        <button
          onClick={onNavigate}
          className="ml-auto rounded-sm p-1.5 text-fg-3 hover:bg-elevated md:hidden"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 py-2">
        {NAV_GROUPS.map((grupo) => (
          <div key={grupo.label} className="grid gap-0.5">
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-fg-3">{grupo.label}</div>
            )}
            {grupo.items.map((it) =>
              it.action === 'settings' ? (
                <button
                  key="settings"
                  onClick={() => {
                    onOpenSettings();
                    onNavigate();
                  }}
                  title={collapsed ? it.label : undefined}
                  className={`shell-nav-link relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                    collapsed ? 'justify-center' : ''
                  }`}
                >
                  <span className="shell-nav-bar" />
                  <it.icon size={18} className="shrink-0" />
                  {!collapsed && <span className="flex-1 truncate text-left">{it.label}</span>}
                </button>
              ) : (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === '/'}
                  onClick={onNavigate}
                  title={collapsed ? it.label : undefined}
                  className={({ isActive }) =>
                    `shell-nav-link relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'is-active' : ''
                    } ${collapsed ? 'justify-center' : ''}`
                  }
                >
                  <span className="shell-nav-bar" />
                  <it.icon size={18} className="shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                  {!collapsed && it.to === '/alertas' && naoLidos > 0 && (
                    <span className="rounded-full bg-down px-1.5 text-[11px] font-bold text-white">{naoLidos}</span>
                  )}
                  {!collapsed && it.to === '/meus-alertas' && naoVistos > 0 && (
                    <span className="rounded-full bg-down px-1.5 text-[11px] font-bold text-white">{naoVistos}</span>
                  )}
                </NavLink>
              ),
            )}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border-soft px-3 py-3">
        <ProfilePopover
          collapsed={collapsed}
          usuario={usuario}
          naoLidos={naoLidos}
          naoVistos={naoVistos}
          tema={tema}
          setTema={setTema}
          onNavigate={onNavigate}
          onOpenSettings={onOpenSettings}
          onSignOut={onSignOut}
        />
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="mt-1 hidden w-full items-center justify-center rounded-xl px-3 py-2 text-fg-3 hover:bg-elevated hover:text-fg-1 md:flex"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
      </div>
    </>
  );
}

export default function AppShell({ children }) {
  const { usuario, signOut } = useAuthStore();
  const { sidebarOpen, toggleSidebar, mobileNavOpen, setMobileNavOpen, setSearchOpen, setSettingsOpen, tema, setTema } =
    useUiStore();
  const { data: alerts } = useAlerts();
  const { data: triggers } = useUserTriggers();
  const navigate = useNavigate();
  const naoLidos = (alerts ?? []).filter((a) => a.ativo && !a.lido).length;
  const naoVistos = (triggers ?? []).filter((t) => !t.visto).length;

  return (
    <div className="flex h-full">
      {/* gaveta mobile — sempre com rótulos, independente do recolher do desktop */}
      <aside
        className={`shell-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col border transition-transform duration-200 md:hidden
          ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent
          collapsed={false}
          usuario={usuario}
          naoLidos={naoLidos}
          naoVistos={naoVistos}
          tema={tema}
          setTema={setTema}
          onNavigate={() => setMobileNavOpen(false)}
          onSignOut={() => {
            signOut();
            navigate('/login');
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </aside>
      {mobileNavOpen && (
        <div className="shell-drawer-veil fixed inset-0 z-40 md:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* ilha flutuante desktop — recolhível */}
      <aside
        className={`shell-sidebar fixed inset-y-4 left-4 z-30 hidden flex-col rounded-2xl border transition-[width] duration-200 md:flex
          ${sidebarOpen ? 'w-64' : 'w-20'}`}
      >
        <SidebarContent
          collapsed={!sidebarOpen}
          usuario={usuario}
          naoLidos={naoLidos}
          naoVistos={naoVistos}
          tema={tema}
          setTema={setTema}
          onNavigate={() => {}}
          onSignOut={() => {
            signOut();
            navigate('/login');
          }}
          onToggleCollapse={toggleSidebar}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </aside>

      <div
        className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-200 ${
          sidebarOpen ? 'md:ml-72' : 'md:ml-28'
        }`}
      >
        <div className="px-3 pt-3 md:px-4 md:pt-4">
          <TickerTape />
        </div>

        <div className="p-3 md:p-4 md:pb-2">
          <header className="shell-topbar flex h-14 items-center gap-2 rounded-2xl border px-3 md:px-4">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded-sm p-2 text-fg-2 hover:bg-elevated md:hidden"
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex flex-1 items-center gap-2 rounded-sm border border-border-main bg-elevated px-3 py-2 text-sm text-fg-3 hover:border-accent md:max-w-sm"
            >
              <Search size={16} />
              <span className="hidden sm:inline">Buscar ativo por ticker ou nome</span>
              <span className="sm:hidden">Buscar</span>
              <kbd className="ml-auto hidden rounded border border-border-main px-1.5 text-[11px] text-fg-3 md:block">/</kbd>
            </button>
          </header>
        </div>

        <main className="min-w-0 flex-1 overflow-y-auto px-3 pb-6 md:px-6">{children}</main>
      </div>

      <SearchDialog />
      <SettingsModal />
    </div>
  );
}

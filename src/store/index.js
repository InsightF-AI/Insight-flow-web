import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** RNF-14 — tema e menu lateral persistem por usuário (aqui, pelo e-mail de login), não só
 * pelo navegador: cada conta guarda sua própria preferência num mapa separado, lido no login
 * e reaplicado a cada carregamento em que a sessão já vier restaurada. */
const PREFS_POR_USUARIO_KEY = 'saa.ui.byUser';

function lerPrefsUsuario(email) {
  if (!email || typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(PREFS_POR_USUARIO_KEY) || '{}')[email] ?? null;
  } catch {
    return null;
  }
}

function gravarPrefsUsuario(email, prefs) {
  if (!email || typeof localStorage === 'undefined') return;
  try {
    const todas = JSON.parse(localStorage.getItem(PREFS_POR_USUARIO_KEY) || '{}');
    localStorage.setItem(PREFS_POR_USUARIO_KEY, JSON.stringify({ ...todas, [email]: prefs }));
  } catch {
    // localStorage indisponível (ex. modo privado) — a preferência só vale para esta sessão.
  }
}

function aplicarTema(tema) {
  if (typeof document === 'undefined') return;
  if (tema === 'claro') document.documentElement.dataset.tema = 'claro';
  else delete document.documentElement.dataset.tema;
}

export const useUiStore = create(
  persist(
    (set, get) => ({
      periodo: '1a',
      overlays: { sma20: true, sma50: true, sma200: false, bollinger: false },
      searchOpen: false,
      settingsOpen: false,
      sidebarOpen: true,
      mobileNavOpen: false,
      notificacoesPush: true,
      notificacoesEmail: false,
      notificacoesMobile: true,
      notificacoesDesktop: true,
      resumoDiario: true,
      iaIndisponivel: false,
      forcarErro: false,
      tema: 'escuro',
      setPeriodo: (periodo) => set({ periodo }),
      toggleOverlay: (k) => set({ overlays: { ...get().overlays, [k]: !get().overlays[k] } }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      toggleSidebar: () => {
        const sidebarOpen = !get().sidebarOpen;
        set({ sidebarOpen });
        gravarPrefsUsuario(useAuthStore.getState().usuario?.email, { tema: get().tema, sidebarOpen });
      },
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setTema: (tema) => {
        aplicarTema(tema);
        set({ tema });
        gravarPrefsUsuario(useAuthStore.getState().usuario?.email, { tema, sidebarOpen: get().sidebarOpen });
      },
      toggleTema: () => {
        const tema = get().tema === 'claro' ? 'escuro' : 'claro';
        aplicarTema(tema);
        set({ tema });
        gravarPrefsUsuario(useAuthStore.getState().usuario?.email, { tema, sidebarOpen: get().sidebarOpen });
      },
      setFlag: (k, v) => set({ [k]: v }),
      /** Reaplica tema + menu lateral do usuário que acabou de entrar (login explícito ou
       * sessão restaurada no carregamento). Sem preferência salva para esse e-mail, usa os
       * padrões — nunca herda o que sobrou de outro usuário na mesma aba/navegador. */
      aplicarPrefsUsuario: (prefs) => {
        const tema = prefs?.tema ?? 'escuro';
        const sidebarOpen = prefs?.sidebarOpen ?? true;
        aplicarTema(tema);
        set({ tema, sidebarOpen });
      },
    }),
    {
      name: 'saa.ui',
      // mobileNavOpen/searchOpen/settingsOpen são estado transitório de overlay — nunca devem
      // sobreviver a um F5 (senão a gaveta/modal reabre sozinha no próximo carregamento).
      partialize: ({ mobileNavOpen, searchOpen, settingsOpen, ...persistido }) => persistido,
      onRehydrateStorage: () => (state) => {
        if (state) aplicarTema(state.tema);
      },
    },
  ),
);

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      signIn: ({ token, usuario }) => {
        set({ token, usuario });
        useUiStore.getState().aplicarPrefsUsuario(lerPrefsUsuario(usuario?.email));
      },
      signOut: () => set({ token: null, usuario: null }),
      updateUsuario: (patch) => set((s) => ({ usuario: { ...s.usuario, ...patch } })),
    }),
    {
      name: 'saa.auth',
      onRehydrateStorage: () => (state) => {
        if (state?.usuario) useUiStore.getState().aplicarPrefsUsuario(lerPrefsUsuario(state.usuario.email));
      },
    },
  ),
);

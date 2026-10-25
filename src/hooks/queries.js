import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useToastStore } from '../store/toastStore.js';
import { notificarDisparo } from '../lib/notify.js';

export const useWatchlist = () => useQuery({ queryKey: ['watchlist'], queryFn: () => api.getWatchlist() });
export const useAsset = (t) => useQuery({ queryKey: ['asset', t], queryFn: () => api.getAsset(t), enabled: !!t });
export const useHistory = (t, p) =>
  useQuery({ queryKey: ['history', t, p], queryFn: () => api.getHistory(t, p), enabled: !!t });
export const useIndicators = (t) =>
  useQuery({ queryKey: ['indicators', t], queryFn: () => api.getIndicatorSnapshot(t), enabled: !!t });
export const useSignals = (params) => useQuery({ queryKey: ['signals', params], queryFn: () => api.getSignals(params) });
export const useSearch = (termo) => useQuery({ queryKey: ['search', termo], queryFn: () => api.searchAssets(termo) });
export const useOperations = () => useQuery({ queryKey: ['operations'], queryFn: () => api.getOperations() });
export const usePositions = () => useQuery({ queryKey: ['positions'], queryFn: () => api.getPositions() });
export const usePortfolio = () => useQuery({ queryKey: ['portfolio'], queryFn: () => api.getPortfolioSummary() });
export const useDistribution = () => useQuery({ queryKey: ['distribution'], queryFn: () => api.getDistribution() });
export const useAlerts = () => useQuery({ queryKey: ['alerts'], queryFn: () => api.getAlerts() });
// sob demanda (botão na tela do ativo): a análise real leva até ~1 min e consome cota do Gemini.
export const useAnalysis = (t, habilitado = true) =>
  useQuery({
    queryKey: ['analysis', t],
    queryFn: () => api.getAssetAnalysis(t),
    enabled: !!t && habilitado,
    retry: false,
    staleTime: 10 * 60_000,
  });
export const useDailySummary = () => useQuery({ queryKey: ['daily'], queryFn: () => api.getDailySummary() });

export const useUserRules = () => useQuery({ queryKey: ['userRules'], queryFn: () => api.getUserRules() });
export const useUserTriggers = () => useQuery({ queryKey: ['userTriggers'], queryFn: () => api.getUserTriggers() });

export function useMarkTriggersSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.marcarTriggersVistos(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userTriggers'] }),
  });
}

export function useUserRuleMutations() {
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const inv = () => {
    qc.invalidateQueries({ queryKey: ['userRules'] });
    qc.invalidateQueries({ queryKey: ['userTriggers'] });
  };
  return {
    create: useMutation({
      mutationFn: (r) => api.createUserRule(r),
      onSuccess: (data) => {
        inv();
        // RN-11: se a condição já estava satisfeita no momento da criação, o disparo é imediato
        if (data.disparo) notificarDisparo(data.disparo, pushToast);
      },
    }),
    update: useMutation({ mutationFn: ({ id, patch }) => api.updateUserRule(id, patch), onSuccess: inv }),
    toggle: useMutation({ mutationFn: (id) => api.toggleUserRule(id), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id) => api.deleteUserRule(id), onSuccess: inv }),
  };
}

export function useCreateOperation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (op) => api.createOperation(op),
    onSuccess: () => {
      // registrar operação de ativo fora da watchlist o adiciona a ela (é assim que ganha ativo_id).
      ['operations', 'positions', 'portfolio', 'distribution', 'watchlist'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useDeleteOperation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.deleteOperation(id),
    onSuccess: () => {
      ['operations', 'positions', 'portfolio', 'distribution'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useWatchlistMutations() {
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  // onSettled retorna a promise: a mutation só sai de isPending quando a lista já recarregou, então o
  // botão não volta ao estado antigo (e aceita outro clique) entre a chamada e o refetch. Recarrega
  // também no erro (ex: 502 do proxy depois de o servidor ter aplicado a mudança), pra tela refletir o real.
  const inv = () => qc.invalidateQueries({ queryKey: ['watchlist'] });
  const avisarErro = (acao) => (err, ticker) =>
    pushToast({ titulo: `${ticker} — não foi possível ${acao}`, texto: err.message, link: `/ativo/${ticker}` });
  return {
    add: useMutation({ mutationFn: (t) => api.addToWatchlist(t), onSettled: inv, onError: avisarErro('adicionar à watchlist') }),
    remove: useMutation({ mutationFn: (t) => api.removeFromWatchlist(t), onSettled: inv, onError: avisarErro('remover da watchlist') }),
    toggle: useMutation({ mutationFn: (t) => api.toggleNotify(t), onSettled: inv, onError: avisarErro('alterar as notificações') }),
  };
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.markAlertRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useMarkAllAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllAlertsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

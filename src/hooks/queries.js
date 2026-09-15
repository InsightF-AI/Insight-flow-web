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
export const useScore = (t) => useQuery({ queryKey: ['score', t], queryFn: () => api.getScore(t), enabled: !!t });
export const useTopMovers = () => useQuery({ queryKey: ['topMovers'], queryFn: () => api.getTopMovers() });
export const useRankings = () => useQuery({ queryKey: ['rankings'], queryFn: () => api.getRankings() });
export const useNews = (ticker) => useQuery({ queryKey: ['news', ticker ?? 'all'], queryFn: () => api.getNews(ticker) });
export const useSearch = (termo) => useQuery({ queryKey: ['search', termo], queryFn: () => api.searchAssets(termo) });
export const useOperations = () => useQuery({ queryKey: ['operations'], queryFn: () => api.getOperations() });
export const usePositions = () => useQuery({ queryKey: ['positions'], queryFn: () => api.getPositions() });
export const usePortfolio = () => useQuery({ queryKey: ['portfolio'], queryFn: () => api.getPortfolioSummary() });
export const useDistribution = () => useQuery({ queryKey: ['distribution'], queryFn: () => api.getDistribution() });
export const useAlerts = () => useQuery({ queryKey: ['alerts'], queryFn: () => api.getAlerts() });
export const useAnalysis = (t) =>
  useQuery({ queryKey: ['analysis', t], queryFn: () => api.getAssetAnalysis(t), enabled: !!t });
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
      ['operations', 'positions', 'portfolio', 'distribution'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
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
  const inv = () => qc.invalidateQueries({ queryKey: ['watchlist'] });
  return {
    add: useMutation({ mutationFn: (t) => api.addToWatchlist(t), onSuccess: inv }),
    remove: useMutation({ mutationFn: (t) => api.removeFromWatchlist(t), onSuccess: inv }),
    toggle: useMutation({ mutationFn: (t) => api.toggleNotify(t), onSuccess: inv }),
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

export const useSessions = () => useQuery({ queryKey: ['sessions'], queryFn: () => api.getSessions() });

export function useAccountMutations() {
  const qc = useQueryClient();
  const invSessions = () => qc.invalidateQueries({ queryKey: ['sessions'] });
  return {
    updateProfile: useMutation({ mutationFn: (p) => api.updateProfile(p) }),
    changePassword: useMutation({ mutationFn: (p) => api.changePassword(p) }),
    revokeSession: useMutation({ mutationFn: (id) => api.revokeSession(id), onSuccess: invSessions }),
    revokeOtherSessions: useMutation({ mutationFn: () => api.revokeOtherSessions(), onSuccess: invSessions }),
  };
}

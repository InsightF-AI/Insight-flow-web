import { create } from 'zustand';

/** Toasts efêmeros in-app (RF-18) — não persistem entre sessões. */
export const useToastStore = create((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set({ toasts: [...get().toasts, { id, ...toast }] });
    setTimeout(() => get().dismiss(id), toast.duracao ?? 7000);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

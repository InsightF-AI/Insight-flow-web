import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/index.js';
import { useToastStore } from '../store/toastStore.js';
import { notificarDisparo } from '../lib/notify.js';

/** RN-06 — intervalos oficiais da especificação. Em desenvolvimento, intervalos curtos
 * tornam o agendador observável numa sessão de demonstração sem esperar 5–15 minutos. */
const INTERVALO_MS = {
  RENDA_VARIAVEL: import.meta.env.DEV ? 45_000 : 15 * 60_000,
  CRIPTO: import.meta.env.DEV ? 20_000 : 5 * 60_000,
};

/** RF-18/UC-07 — agendador em memória: reavalia as regras do usuário periodicamente
 * (renda variável e cripto em cadências diferentes) e entrega os disparos novos via
 * notificação nativa do navegador + toast in-app. Não renderiza nada visível. */
export default function NotificationScheduler() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    if (!token) return undefined;

    const processar = async (classe) => {
      const disparadas = await api.reavaliarRegrasUsuario(classe);
      if (disparadas.length === 0) return;
      qc.invalidateQueries({ queryKey: ['userRules'] });
      qc.invalidateQueries({ queryKey: ['userTriggers'] });
      for (const t of disparadas) notificarDisparo(t, pushToast);
    };

    processar('RENDA_VARIAVEL');
    processar('CRIPTO');
    const idRendaVariavel = setInterval(() => processar('RENDA_VARIAVEL'), INTERVALO_MS.RENDA_VARIAVEL);
    const idCripto = setInterval(() => processar('CRIPTO'), INTERVALO_MS.CRIPTO);
    return () => {
      clearInterval(idRendaVariavel);
      clearInterval(idCripto);
    };
  }, [token, qc, pushToast]);

  return null;
}

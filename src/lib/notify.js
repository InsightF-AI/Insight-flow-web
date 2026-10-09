import { useUiStore } from '../store/index.js';

/** RF-18/UC-07 — entrega de um disparo de regra: toast in-app sempre, notificação
 * nativa do navegador quando o canal PUSH foi realmente concedido (`entrega.PUSH ===
 * 'entregue'`, calculado em api/client.js). Usado tanto pela criação de regra (disparo
 * imediato quando a condição já está satisfeita) quanto pelo agendador periódico. */
export function notificarDisparo(trigger, pushToast) {
  pushToast({
    titulo: trigger.ticker ? `${trigger.ticker} — alerta disparado` : 'Nova notificação',
    texto: trigger.texto,
    link: trigger.ticker ? `/ativo/${trigger.ticker}` : '/meus-alertas',
  });
  // com web push ativo, a notificação nativa vem do service worker (evita duplicar).
  if (useUiStore.getState().webPushAtivo) return;
  if (trigger.entrega?.PUSH === 'entregue' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(`InsightFlow — ${trigger.ticker}`, { body: trigger.texto, tag: trigger.id });
    } catch {
      // Alguns navegadores bloqueiam Notification fora de um gesto do usuário; o toast já cobre a entrega in-app.
    }
  }
}

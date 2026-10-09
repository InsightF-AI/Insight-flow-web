import { api } from '../api/client.js';

/** Web push (RF-18/UC-05): registra o service worker, inscreve o navegador com a chave VAPID
 * pública do backend e envia a inscrição para POST /web-push/inscricoes. Assim as notificações
 * chegam mesmo com a aba fechada (o WebSocket só entrega com o app aberto). */

export const webPushSuportado = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';

// a chave pública VAPID vem em base64url; o PushManager espera bytes.
function base64UrlParaBytes(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Inscreve (ou reaproveita a inscrição existente) e registra no backend — idempotente. */
export async function ativarWebPush() {
  if (!webPushSuportado()) throw new Error('Este navegador não suporta web push.');
  if (Notification.permission !== 'granted') throw new Error('Permissão de notificação não concedida.');
  const registro = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    const { chave_publica } = await api.getChavePublicaWebPush();
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaBytes(chave_publica),
    });
  }
  const { endpoint, keys } = inscricao.toJSON();
  await api.registrarInscricaoWebPush({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
}

/** Cancela a inscrição no navegador e remove do backend. */
export async function desativarWebPush() {
  if (!webPushSuportado()) return;
  const registro = await navigator.serviceWorker.getRegistration('/sw.js');
  const inscricao = await registro?.pushManager.getSubscription();
  if (!inscricao) return;
  await api.removerInscricaoWebPush(inscricao.endpoint).catch(() => {});
  await inscricao.unsubscribe();
}

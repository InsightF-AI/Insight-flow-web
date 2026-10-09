/* Service worker do web push (POST /web-push/inscricoes). O backend envia
 * {title, body, data: {notificacao_id, tipo, ativo_id}} cifrado com VAPID. */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() };
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // com o app visível, o toast in-app (via WebSocket) já avisa — evita notificação duplicada.
      if (janelas.some((j) => j.visibilityState === 'visible')) return undefined;
      return self.registration.showNotification(payload.title || 'InsightFlow', {
        body: payload.body || '',
        icon: '/icone.png',
        tag: payload.data?.notificacao_id,
        data: payload.data,
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas[0];
      if (aberta) return aberta.focus();
      return self.clients.openWindow('/meus-alertas');
    }),
  );
});

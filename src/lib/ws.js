export function urlDoWebSocket(urlConfigurada, location) {
  if (urlConfigurada) return urlConfigurada;
  const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocolo}://${location.host}/api/v1/notificacoes/ws`;
}

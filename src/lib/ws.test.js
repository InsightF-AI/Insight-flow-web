import { describe, expect, it } from 'vitest';

import { urlDoWebSocket } from './ws.js';

describe('urlDoWebSocket', () => {
  it('usa a URL configurada quando ela existe', () => {
    const configurada = 'wss://hom-api-insight.agilesoftware.net.br/api/v1/notificacoes/ws';

    expect(urlDoWebSocket(configurada, { protocol: 'https:', host: 'hom-insight.agilesoftware.net.br' })).toBe(
      configurada,
    );
  });

  it('em página https monta wss na própria origem', () => {
    expect(urlDoWebSocket(undefined, { protocol: 'https:', host: 'hom-insight.agilesoftware.net.br' })).toBe(
      'wss://hom-insight.agilesoftware.net.br/api/v1/notificacoes/ws',
    );
  });

  it('em página http monta ws na própria origem, mantendo a porta', () => {
    expect(urlDoWebSocket(undefined, { protocol: 'http:', host: 'localhost:5173' })).toBe(
      'ws://localhost:5173/api/v1/notificacoes/ws',
    );
  });

  it('trata string vazia como variável não definida', () => {
    expect(urlDoWebSocket('', { protocol: 'https:', host: 'insight.agilesoftware.net.br' })).toBe(
      'wss://insight.agilesoftware.net.br/api/v1/notificacoes/ws',
    );
  });
});

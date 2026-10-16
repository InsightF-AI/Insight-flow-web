import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './client.js';
import { useAuthStore } from '../store/index.js';

function tokenComSub(sub) {
  const payload = btoa(JSON.stringify({ sub })).replace(/\+/g, '-').replace(/\//g, '_');
  return `cabecalho.${payload}.assinatura`;
}

function respostaDoFetch(corpo, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

const ID_DO_USUARIO = '0191c7e0-0000-4000-8000-000000000001';

beforeEach(() => {
  useAuthStore.getState().signOut();
  vi.stubGlobal('fetch', vi.fn());
});

describe('api.login', () => {
  it('faz POST no caminho relativo da API e devolve a sessão', async () => {
    fetch.mockResolvedValue(
      respostaDoFetch({ access_token: tokenComSub(ID_DO_USUARIO), refresh_token: 'refresh-123' }),
    );

    const sessao = await api.login({ email: 'maria.souza@exemplo.com', senha: 'segredo123' });

    const [caminho, opcoes] = fetch.mock.calls[0];
    expect(caminho).toBe('/api/v1/auth/login');
    expect(opcoes.method).toBe('POST');
    expect(JSON.parse(opcoes.body)).toEqual({ email: 'maria.souza@exemplo.com', senha: 'segredo123' });
    expect(opcoes.headers.Authorization).toBeUndefined();
    expect(sessao.refreshToken).toBe('refresh-123');
    expect(sessao.usuario).toEqual({
      id: ID_DO_USUARIO,
      nome: 'Maria.souza',
      email: 'maria.souza@exemplo.com',
    });
  });

  it('transforma credencial inválida na mensagem que o backend mandou', async () => {
    fetch.mockResolvedValue(respostaDoFetch({ detail: 'Credenciais inválidas' }, 401));

    await expect(api.login({ email: 'maria@exemplo.com', senha: 'errada' })).rejects.toThrow(
      'Credenciais inválidas',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('usa a primeira mensagem quando o 422 do FastAPI devolve uma lista', async () => {
    fetch.mockResolvedValue(
      respostaDoFetch({ detail: [{ msg: 'E-mail inválido' }, { msg: 'Senha muito curta' }] }, 422),
    );

    await expect(api.login({ email: 'sem-arroba', senha: '123' })).rejects.toThrow('E-mail inválido');
  });
});

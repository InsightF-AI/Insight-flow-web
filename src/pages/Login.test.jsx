import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Login from './Login.jsx';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/index.js';

vi.mock('../api/client.js', () => ({ api: { login: vi.fn() } }));

const SESSAO = {
  token: 'token-de-acesso',
  refreshToken: 'token-de-renovacao',
  usuario: { id: 'u-1', nome: 'Maria', email: 'maria@exemplo.com' },
};

function montarLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<h1>Painel</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function preencherEEntrar(email, senha) {
  const usuario = userEvent.setup();
  await usuario.type(screen.getByLabelText('E-mail'), email);
  await usuario.type(screen.getByLabelText('Senha'), senha);
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
}

beforeEach(() => {
  useAuthStore.getState().signOut();
});

describe('tela de login', () => {
  it('envia o que foi digitado, guarda a sessão e sai da tela de login', async () => {
    api.login.mockResolvedValue(SESSAO);
    montarLogin();

    await preencherEEntrar('maria@exemplo.com', 'segredo123');

    expect(api.login).toHaveBeenCalledWith({ email: 'maria@exemplo.com', senha: 'segredo123' });
    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe('token-de-acesso');
  });

  it('mostra a mensagem do erro e mantém o usuário na tela quando o login falha', async () => {
    api.login.mockRejectedValue(new Error('Credenciais inválidas'));
    montarLogin();

    await preencherEEntrar('maria@exemplo.com', 'errada');

    expect(await screen.findByText('Credenciais inválidas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
  });
});

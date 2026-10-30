import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OperationModal from './OperationModal.jsx';
import { api } from '../api/client.js';

vi.mock('../api/client.js', () => ({
  api: {
    getWatchlist: vi.fn(),
    getCatalogo: vi.fn(),
    getCotacaoAtual: vi.fn(),
    getPositions: vi.fn(),
    createOperation: vi.fn(),
  },
}));

const CATALOGO = [
  { id: 'id-abev3', ticker: 'ABEV3', nome: 'AMBEV S.A.', tipo: 'ACAO', setor: null, moeda: 'BRL' },
  { id: 'id-btc', ticker: 'BTC', nome: 'Bitcoin', tipo: 'CRIPTO', setor: null, moeda: 'BRL' },
];
const PRECOS = { 'id-abev3': 14.66, 'id-btc': 416915 };

function montar(open) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const arvore = (aberto) => (
    <QueryClientProvider client={queryClient}>
      <OperationModal open={aberto} onClose={() => {}} />
    </QueryClientProvider>
  );
  const resultado = render(arvore(open));
  return {
    ...resultado,
    abrir: () => resultado.rerender(arvore(true)),
    fechar: () => resultado.rerender(arvore(false)),
  };
}

beforeEach(() => {
  api.getWatchlist.mockResolvedValue([]);
  api.getCatalogo.mockResolvedValue(CATALOGO);
  api.getPositions.mockResolvedValue([]);
  api.getCotacaoAtual.mockImplementation(async (id) => PRECOS[id]);
});

describe('OperationModal', () => {
  it('preenche o preço do primeiro ativo do catálogo ao abrir depois de carregar', async () => {
    const { abrir } = montar(false);
    await waitFor(() => expect(api.getCatalogo).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));

    abrir();

    await waitFor(() => expect(screen.getByLabelText('Preço unitário')).toHaveValue(14.66));
  });

  it('preenche o preço ao abrir antes do catálogo carregar', async () => {
    montar(true);

    await waitFor(() => expect(screen.getByLabelText('Preço unitário')).toHaveValue(14.66));
  });

  it('troca o preço ao escolher outro ativo', async () => {
    montar(true);
    await waitFor(() => expect(screen.getByLabelText('Preço unitário')).toHaveValue(14.66));

    const usuario = userEvent.setup();
    await usuario.clear(screen.getByLabelText('Ativo'));
    await usuario.type(screen.getByLabelText('Ativo'), 'bitc');
    await usuario.click(screen.getByRole('button', { name: /Bitcoin/ }));

    await waitFor(() => expect(screen.getByLabelText('Preço unitário')).toHaveValue(416915));
  });

  it('preenche o preço de novo ao fechar e reabrir o modal', async () => {
    const { abrir, fechar } = montar(true);
    await waitFor(() => expect(screen.getByLabelText('Preço unitário')).toHaveValue(14.66));

    fechar();
    abrir();

    await waitFor(() => expect(screen.getByLabelText('Preço unitário')).toHaveValue(14.66));
  });

  it('preenche o preço ao escolher de novo o mesmo ativo', async () => {
    montar(true);
    await waitFor(() => expect(screen.getByLabelText('Preço unitário')).toHaveValue(14.66));

    const usuario = userEvent.setup();
    await usuario.clear(screen.getByLabelText('Ativo'));
    await usuario.type(screen.getByLabelText('Ativo'), 'ambev');
    await usuario.click(screen.getByRole('button', { name: /AMBEV/ }));

    await waitFor(() => expect(screen.getByLabelText('Preço unitário')).toHaveValue(14.66));
  });

  it('não sobrescreve o preço que a pessoa digitou', async () => {
    api.getCotacaoAtual.mockImplementation(() => new Promise((r) => setTimeout(() => r(14.66), 50)));
    montar(true);
    await waitFor(() => expect(screen.getByLabelText('Ativo')).toHaveValue('ABEV3 — AMBEV S.A.'));

    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText('Preço unitário'), '15');
    await new Promise((r) => setTimeout(r, 100));

    expect(screen.getByLabelText('Preço unitário')).toHaveValue(15);
  });
});

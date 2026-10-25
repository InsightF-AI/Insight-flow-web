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

describe('ativo fora da watchlist', () => {
  it('não inventa histórico, sinais nem análise: pede pra adicionar à watchlist', async () => {
    fetch.mockResolvedValue(respostaDoFetch([]));

    for (const chamada of [
      () => api.getHistory('WEGE3', '1m'),
      () => api.getIndicatorSnapshot('WEGE3'),
      () => api.getSignals({ ticker: 'WEGE3' }),
      () => api.getAssetAnalysis('WEGE3'),
    ]) {
      await expect(chamada()).rejects.toMatchObject({ code: 'FORA_DA_WATCHLIST' });
    }
    // só consultou a watchlist — nenhuma rota de ativo foi chamada sem ativo_id.
    expect(fetch.mock.calls.every(([caminho]) => caminho === '/api/v1/watchlist')).toBe(true);
  });

  it('mostra o ativo pela busca, sem cotação', async () => {
    fetch.mockImplementation(async (caminho) =>
      respostaDoFetch(
        caminho.startsWith('/api/v1/ativos/buscar')
          ? [{ ticker: 'WEGE3', nome: 'WEG ON', tipo: 'ACAO', setor: 'Bens Industriais', moeda: 'BRL' }]
          : [],
      ),
    );

    const ativo = await api.getAsset('WEGE3');

    expect(ativo).toMatchObject({ ticker: 'WEGE3', nome: 'WEG ON', fonte: 'brapi', cotacao: null });
  });
});

describe('api.getPortfolioSummary', () => {
  const posicao = (ativo_id, ticker, valor) => ({
    ativo_id,
    ticker,
    quantidade: '10',
    preco_medio: '10',
    valor_mercado: String(valor),
    valor_mercado_brl: String(valor),
    lucro_nao_realizado: '0',
    lucro_realizado: '0',
    cotacao_atual: '10',
  });

  it('não transforma cotação nem benchmark que falhou em 0%', async () => {
    fetch.mockImplementation(async (caminho) => {
      const rotas = {
        '/api/v1/portfolio/rentabilidade': respostaDoFetch({
          custo_base_brl: '1000',
          valor_mercado_brl: '1100',
          lucro_nao_realizado_brl: '100',
          lucro_realizado_brl: '40',
          percentual: '0.1',
        }),
        '/api/v1/portfolio/benchmark?benchmark=CDI': respostaDoFetch({ rentabilidade_benchmark_percentual: '0.02' }),
        '/api/v1/portfolio/benchmark?benchmark=IBOVESPA': respostaDoFetch({ detail: 'fora do ar' }, 503),
        '/api/v1/portfolio/posicoes': respostaDoFetch([posicao('a1', 'PETR4', 600), posicao('a2', 'VALE3', 500)]),
        '/api/v1/ativos/a1/cotacao': respostaDoFetch({ variacao_percentual: '2' }),
        '/api/v1/ativos/a2/cotacao': respostaDoFetch({ detail: 'fora do ar' }, 503),
      };
      return rotas[caminho] ?? respostaDoFetch([]);
    });

    const resumo = await api.getPortfolioSummary();

    // resultado acompanha o percentual da API (não realizado / custo); o realizado vem à parte.
    expect(resumo.resultado).toBe(100);
    expect(resumo.resultado_pct).toBe(10);
    expect(resumo.lucro_realizado).toBe(40);
    // VALE3 sem cotação fica fora da média, em vez de puxar a variação do dia pra baixo.
    expect(resumo.variacao_dia_pct).toBe(2);
    expect(resumo.benchmarks).toEqual({ cdi: 2, ibovespa: null });
    expect(resumo.curva.map((p) => p.ibovespa)).toEqual([null, null]);
  });
});

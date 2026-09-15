# Sistema de Análise de Ativos — cliente web (v1, dados mockados)

Cliente web do Sistema de Análise de Ativos do Mercado Financeiro (documentação técnica v1.0, agosto/2026).
Esta versão implementa todas as telas do cliente web sobre uma **camada de dados mockada em memória** — sem backend,
sem chamadas a APIs externas e sem chamadas a provedor de LLM.

## Stack

| Camada | Tecnologia |
|---|---|
| Build | Vite 5 |
| UI | React 18 |
| Estado de servidor | TanStack Query 5 |
| Estado global | Zustand 5 (com `persist`) |
| Candles | Lightweight Charts 4 (TradingView) |
| Gráficos auxiliares | Recharts 2 |
| Estilo | Tailwind CSS 3 (tokens do design system EngSeg/SGS, tema dark) |
| Navegação | React Router 6 |
| Ícones | lucide-react |

## Rodar localmente

```bash
cd web
npm install
npm run dev
```

Login: qualquer e-mail válido e qualquer senha (o formulário já vem pré-preenchido).

## Deploy na Netlify

O `netlify.toml` já está configurado (`base = "web"`, build `npm run build`, publish `dist`, redirect SPA).

- **Via Git:** conecte o repositório; a Netlify lê o `netlify.toml` automaticamente.
- **Via CLI:** `npm run build && npx netlify deploy --prod --dir=dist`.

Se o repositório tiver a pasta `web` na raiz, mantenha o `netlify.toml` na raiz do repositório ou defina
*Base directory* = `web` nas configurações do site.

## Estrutura

```
web/
├── netlify.toml
├── tailwind.config.js        # tokens de cor/tipografia do design system
├── public/icone.png          # logo
└── src/
    ├── App.jsx               # rotas + guarda de autenticação
    ├── api/
    │   ├── client.js         # ÚNICO ponto de integração — 1 função por endpoint REST
    │   └── mock/
    │       ├── assets.js     # universo de ativos + gerador OHLCV determinístico
    │       ├── signals.js    # regras de sinal, sinais e backtests
    │       ├── portfolio.js  # operações, curva de patrimônio, watchlist
    │       └── ai.js         # textos de IA e respostas do chat
    ├── hooks/queries.js      # hooks TanStack Query e mutations
    ├── store/index.js        # Zustand: auth (persistida) e preferências de UI
    ├── lib/
    │   ├── indicators.js     # SMA, EMA, RSI, MACD, Bollinger, volume relativo
    │   └── format.js         # formatação pt-BR
    ├── components/
    │   ├── AppShell.jsx      # sidebar + topbar + busca global (tecla /)
    │   ├── PriceChart.jsx    # candles + volume + overlays (Lightweight Charts)
    │   ├── Charts.jsx        # RSI, MACD, benchmarks, sparkline (Recharts)
    │   ├── OperationModal.jsx
    │   ├── SearchDialog.jsx
    │   ├── Disclaimer.jsx    # aviso legal obrigatório
    │   └── ui.jsx            # Card, Pill, Kpi, Skeleton, Empty
    └── pages/
        ├── Login.jsx / Register.jsx
        ├── Dashboard.jsx     # KPIs, watchlist, resumo diário, sinais ativos
        ├── AssetDetail.jsx   # candles, RSI, MACD, sinais + backtest, análise IA, score
        ├── Portfolio.jsx     # posições, benchmarks, distribuição, operações
        ├── Chat.jsx          # chat com function calling simulado
        ├── Alerts.jsx        # alertas com contexto histórico de 24 meses
        ├── SearchPage.jsx    # busca e inclusão na watchlist
        └── Settings.jsx      # conta, notificações globais e por ativo
```

## Rastreabilidade com a documentação

| Requisito / caso de uso | Onde |
|---|---|
| RF-01, RF-02 (cadastro, autenticação) | `pages/Login.jsx`, `pages/Register.jsx`, `store/index.js` |
| RF-03, RN-08 (watchlist, notificação padrão) | `pages/Dashboard.jsx`, `pages/SearchPage.jsx`, `api/client.js` |
| RF-04, RF-05 (cotação, histórico OHLCV) | `api/mock/assets.js`, `components/PriceChart.jsx` |
| RF-06 (SMA, RSI, MACD, Bollinger, volume relativo) | `lib/indicators.js` — cálculo real sobre a série |
| RF-07, RF-08, RN-03 (sinais e backtest de 24 meses) | `api/mock/signals.js`, `pages/AssetDetail.jsx`, `pages/Alerts.jsx` |
| RF-09 (alertas) | `pages/Alerts.jsx`, badge no `AppShell` |
| RF-10 a RF-12 (operações, rentabilidade, distribuição) | `pages/Portfolio.jsx`, `components/OperationModal.jsx` |
| RF-13, RF-14, RF-15 (análise, resumo diário, chat) | `api/mock/ai.js`, `pages/AssetDetail.jsx`, `pages/Chat.jsx` |
| RF-16, RN-01, RN-05 (aviso legal, linguagem factual) | `components/Disclaimer.jsx` — presente em toda saída de IA |
| RN-04 (portfólio simulado) | avisado no cabeçalho do Portfólio |

## Trocar o mock pelo backend real

Todo o acesso a dados passa por `src/api/client.js`. Cada método corresponde a um endpoint do FastAPI:
substitua o corpo por `fetch` e o restante da aplicação não muda.

```js
const base = import.meta.env.VITE_API_URL;
const auth = () => ({ Authorization: `Bearer ${useAuthStore.getState().token}` });

async getWatchlist() {
  const r = await fetch(`${base}/watchlist`, { headers: auth() });
  if (!r.ok) throw new Error('Falha ao carregar watchlist');
  return r.json();
}
```

Pontos de atenção na migração:

1. **Indicadores** — hoje calculados no cliente (`lib/indicators.js`). No backend, o `IndicadorService` já retorna os
   valores; use `lib/indicators.js` apenas como referência de cálculo ou remova.
2. **Séries OHLCV** — `generateCandles()` é sintético e determinístico. Substituir por `GET /ativos/{ticker}/historico`.
3. **IA** — `getAssetAnalysis`, `getDailySummary` e `askAI` retornam fixtures. Apontar para os endpoints do
   `AnaliseIAService`; a UI já trata estado de carregamento e exibe o aviso legal.
4. **Notificações** — a v1 lista alertas por polling do TanStack Query. Para push real, conectar WebSocket/SSE e
   invalidar `['alerts']` no recebimento.
5. **Sessão** — o token JWT é persistido no `localStorage` via Zustand. Implementar refresh token conforme RNF-04.
6. **Escala do gráfico** — `PriceChart` usa a API do Lightweight Charts 4 (`addCandlestickSeries`). Ao subir para a
   v5, trocar por `addSeries(CandlestickSeries, …)`.

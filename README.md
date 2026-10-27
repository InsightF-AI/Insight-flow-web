# Sistema de Análise de Ativos — cliente web

Cliente web do Sistema de Análise de Ativos do Mercado Financeiro (documentação técnica v1.0, agosto/2026),
integrado à API do InsightFlow (FastAPI). O que a API ainda não oferece aparece na tela com o selo **Ilustrativo**
(ver [O que vem da API](#o-que-vem-da-api)).

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
npm install
cp .env.example .env.local   # VITE_API_URL = raiz da API que o proxy do Vite vai usar
npm run dev
npm test                      # vitest (o CI roda antes de cada deploy)
```

Login com uma conta da API apontada em `VITE_API_URL` (ou crie uma em *Criar cadastro*). Em `npm run dev`,
Configurações tem um card **Modo desenvolvedor** (simular IA indisponível e erro de carregamento); ele não existe
no build publicado.

## Deploy em container

O front roda em container Nginx, que serve o estático e repassa `/api/` e o WebSocket para a API.
Front e API ficam na mesma origem para o navegador, então não há CORS a liberar no backend.

- Homologação: https://hom-insight.agilesoftware.net.br (VM da Azure), a cada push no `main`.
- Produção: https://insight.agilesoftware.net.br (VPS da Hostinger), só por tag `vX.Y.Z` ou disparo manual.

Imagem: `ghcr.io/insightf-ai/insight-flow-web`. Domínios, variáveis, secrets e rollback estão em
[`docs/deploy.md`](docs/deploy.md). Estratégia de testes em [`docs/testes.md`](docs/testes.md).

## Estrutura

```
web/
├── Dockerfile               # build do estático + Nginx que serve e repassa /api
├── nginx.conf.template      # SPA, cache dos assets e proxy da API e do WebSocket
├── deploy/                  # composes de homologação e produção
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
        ├── Chat.jsx          # chat com a IA do backend (POST /chat)
        ├── Alerts.jsx        # alertas com contexto histórico de 24 meses
        ├── SearchPage.jsx    # busca e inclusão na watchlist
        └── Settings.jsx      # conta, aparência, web push e notificações por ativo
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

## O que vem da API

Todo o acesso a dados passa por `src/api/client.js`.

| Vem da API | Ainda ilustrativo (selo na tela) | Não disponível (a tela avisa) |
|---|---|---|
| cadastro, login, refresh e logout | | alterar nome, e-mail ou senha |
| watchlist, busca, cotação, histórico, indicadores | | recuperação de senha por e-mail |
| sinais e backtest, alertas, notificações (REST + WebSocket), web push | score de oportunidade (a API não expõe o peso das regras) | |
| operações, posições, rentabilidade, benchmarks, distribuição | | |
| análise por IA e chat | | |
| rankings dos ativos da watchlist (altas, baixas, volume relativo, sinais) | | rankings de mercado (a API não tem a rota) |

As notícias do Dashboard não vêm da API (ela não tem rota de notícias): são manchetes reais do Google News
sobre os tickers da watchlist, buscadas em `/noticias/rss`. Esse caminho é repassado ao RSS do Google News pelo
Nginx do container (com cache de 10 min) e, em dev, pelo proxy do Vite.

A API só dá um `ativo_id` a um ativo depois que ele entra na watchlist. Por isso, na tela de um ativo fora da
watchlist, cotação, histórico, indicadores e sinais são ilustrativos, e a tela avisa. Se a cotação real falhar
(503 da fonte de mercado), a tela mostra "Cotação indisponível" em vez de travar.

Pontos de atenção:

1. **Indicadores**: o snapshot vem de `GET /ativos/{id}/indicadores`; a série por candle dos gráficos é calculada
   no cliente (`lib/indicators.js`) sobre o histórico real.
2. **Escala do gráfico**: `PriceChart` usa a API do Lightweight Charts 4 (`addCandlestickSeries`). Ao subir para a
   v5, trocar por `addSeries(CandlestickSeries, …)`.

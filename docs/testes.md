# Estratégia de testes — cliente web

A pirâmide tem três andares. **Base:** testes de unidade em código puro, sem navegador — as funções de indicadores (`src/lib/indicators.js`) e o cliente HTTP (`src/api/client.js`), com o `fetch` substituído por um duplo. **Meio:** teste de componente com a Testing Library — a tela renderizada de verdade no jsdom, operada como o usuário opera e verificada pelo que aparece. **Topo:** ponta a ponta com navegador real não existe na V0; o fluxo completo é validado à mão.

Cobertura da V0: bordas de `sma` e `rsi` (série vazia, período maior que a série, primeira posição com valor); `api.login` (caminho relativo, corpo enviado, sessão devolvida, erro 401 e erro 422 do FastAPI em lista); formulário de login (envia o que foi digitado, navega no sucesso, mostra a mensagem no erro). Nenhum teste usa rede nem variável `VITE_*`.

Fica para depois: ponta a ponta com Playwright, teste de contrato contra a API de homologação e cobertura das telas de carteira, alertas e chat.

TDD é o ciclo vermelho, verde, refatora: primeiro o teste que falha, depois o código mínimo que o faz passar, e só então a melhoria do desenho. O caso da série vazia do `rsi` entrou nessa ordem, em dois commits.

São **15 testes** em 3 arquivos. Rodar: `npm test` (uma passada) ou `npm run test:watch`.

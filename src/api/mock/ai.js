/** Textos de IA mockados (RF-13 a RF-16). Nenhuma chamada externa é feita nesta versão.
 * A análise por ativo e o resumo diário (RF-13/RF-14) são gerados deterministicamente
 * a partir dos indicadores e da carteira reais em `api/client.js` — não há mais fixture
 * de texto por ticker aqui. */
export const DISCLAIMER = 'Análise gerada por IA. Não constitui recomendação de investimento.';

/** RF-15 — respostas do chat via function calling simulado: o roteador de intenção
 * e as funções que consultam o estado real da carteira vivem em `api/client.js`
 * (askAI). Aqui ficam só o texto de fallback e as sugestões de pergunta. */
export const CHAT_FALLBACK =
  'Não encontrei essa informação nos dados da sua carteira. Nesta versão o chat consulta: resultado da carteira, exposição por classe e setor, comparação com CDI e Ibovespa, sinais ativos, o ativo com melhor ou pior retorno, e o histórico de operações.';

export const CHAT_SUGGESTIONS = [
  'Qual foi meu ativo mais rentável?',
  'Como está minha exposição por setor?',
  'A carteira está acima do CDI?',
  'Quais sinais estão ativos agora?',
  'Qual é o resultado da carteira?',
  'Quais foram minhas últimas operações?',
];

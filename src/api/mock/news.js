/** Notícias de mercado mockadas — textos fictícios, sem chamada a provedor externo. */
const h = (n) => new Date(Date.now() - n * 3600_000).toISOString();

export const NEWS = [
  { id: 'n1', ticker: 'PETR4', titulo: 'Petrobras anuncia revisão do plano de investimentos para o próximo ciclo', fonte: 'Mercado Agora', data: h(3) },
  { id: 'n2', ticker: 'VALE3', titulo: 'Vale eleva projeção de produção de minério de ferro para o trimestre', fonte: 'Capital Aberto', data: h(6) },
  { id: 'n3', ticker: 'ITUB4', titulo: 'Itaú Unibanco reporta crescimento da carteira de crédito no varejo', fonte: 'Valor Econômico', data: h(9) },
  { id: 'n4', ticker: 'BTC', titulo: 'Bitcoin oscila após dados de inflação nos Estados Unidos', fonte: 'Cripto Notícias', data: h(2) },
  { id: 'n5', ticker: 'WEGE3', titulo: 'WEG amplia capacidade produtiva em unidade no exterior', fonte: 'Mercado Agora', data: h(14) },
  { id: 'n6', ticker: 'MGLU3', titulo: 'Magazine Luiza apresenta plano de redução de despesas operacionais', fonte: 'Capital Aberto', data: h(20) },
  { id: 'n7', ticker: 'HGLG11', titulo: 'FII de logística anuncia distribuição de rendimentos do mês', fonte: 'Fundos Imobiliários Hoje', data: h(11) },
  { id: 'n8', ticker: 'ETH', titulo: 'Ethereum registra aumento de atividade na rede após atualização', fonte: 'Cripto Notícias', data: h(17) },
  { id: 'n9', ticker: 'BBAS3', titulo: 'Banco do Brasil detalha estratégia de expansão do crédito rural', fonte: 'Valor Econômico', data: h(23) },
  { id: 'n10', ticker: 'VALE3', titulo: 'Preço do minério de ferro reage a estímulos econômicos na China', fonte: 'Mercado Agora', data: h(30) },
];

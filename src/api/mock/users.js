/** Contas cadastradas (mock) — usada para simular a checagem de unicidade de
 * e-mail no cadastro (RF-01). O e-mail abaixo é o mesmo pré-preenchido na
 * tela de login, então tentar cadastrá-lo de novo demonstra o conflito. */
export const USERS = [
  { id: 'u1', nome: 'Investidor Demo', email: 'investidor@exemplo.com', criado_em: '2026-01-15' },
];

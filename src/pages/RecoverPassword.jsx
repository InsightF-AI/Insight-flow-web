import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { AuthLayout } from './Login.jsx';

/** A API ainda não tem rota de recuperação de senha: em vez de simular o envio de um e-mail
 * que nunca chega, a tela explica o que fazer. */
export default function RecoverPassword() {
  return (
    <AuthLayout
      titulo="Recuperar senha"
      footer={
        <>
          Lembrou a senha? <Link to="/login">Entrar</Link>
        </>
      }
    >
      <div className="grid gap-4 text-center">
        <div className="grid justify-items-center gap-2 rounded-sm border border-border-soft bg-elevated px-4 py-5">
          <KeyRound size={22} className="text-accent" />
          <p className="text-sm text-fg-1">
            A recuperação de senha por e-mail ainda não está disponível. Fale com o administrador do sistema para
            redefinir o seu acesso.
          </p>
        </div>
        <Link to="/login" className="btn-primary">Voltar ao login</Link>
      </div>
    </AuthLayout>
  );
}

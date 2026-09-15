import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Mail, MailCheck } from 'lucide-react';
import { api } from '../api/client.js';
import { AuthLayout } from './Login.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RecoverPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [erro, setErro] = useState('');

  const mut = useMutation({ mutationFn: () => api.recoverPassword({ email }) });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setErro('Informe um e-mail válido.');
      return;
    }
    setErro('');
    mut.mutate();
  };

  return (
    <AuthLayout
      titulo="Recuperar senha"
      subtitulo="Informe seu e-mail de cadastro. Se houver uma conta associada, enviaremos instruções."
      footer={
        <>
          Lembrou a senha? <Link to="/login">Entrar</Link>
        </>
      }
    >
      {mut.isSuccess ? (
        <div className="grid gap-4 text-center">
          <div className="grid justify-items-center gap-2 rounded-sm border border-border-soft bg-elevated px-4 py-5">
            <MailCheck size={22} className="text-accent" />
            <p className="text-sm text-fg-1">
              Se <strong className="text-fg-0">{email}</strong> estiver cadastrado, você vai receber um e-mail com
              instruções para redefinir a senha.
            </p>
          </div>
          <Link to="/login" className="btn-primary">Voltar ao login</Link>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <div>
            <label className="label" htmlFor="email-recuperar">E-mail</label>
            <div className="field-icon-wrap">
              <Mail className="field-icon" />
              <input
                id="email-recuperar"
                className={`input ${erro ? 'border-down' : ''}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {erro && <p className="mt-1.5 text-xs text-down">{erro}</p>}
          </div>
          <button className="btn-primary mt-2" disabled={mut.isPending}>
            {mut.isPending ? 'Enviando…' : 'Enviar instruções'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

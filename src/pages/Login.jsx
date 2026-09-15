import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuthStore, useUiStore } from '../store/index.js';

export function AuthLayout({ titulo, subtitulo, children, footer }) {
  const tema = useUiStore((s) => s.tema);
  return (
    <div className="grid h-dvh max-h-dvh overflow-hidden lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-border-soft bg-surface lg:block">
        <img
          src={tema === 'claro' ? '/login-hero-light.png' : '/login-hero.png'}
          alt="Sistema de Análise de Ativos — indicadores técnicos, sinais e carteira simulada em um só lugar."
          className="h-full w-full object-cover"
        />
        <div className="login-hero-shade pointer-events-none absolute inset-0" />
        <div className="absolute left-6 top-6 flex items-center gap-3">
          <img
            src="/icone.png"
            alt=""
            className={`h-14 w-14 ${
              tema === 'claro' ? 'drop-shadow-[0_2px_10px_rgba(255,255,255,0.7)]' : 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]'
            }`}
          />
          <div
            className={`leading-tight ${
              tema === 'claro'
                ? 'drop-shadow-[0_2px_6px_rgba(255,255,255,0.85)]'
                : 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]'
            }`}
          >
            <div className={`font-display text-base font-bold ${tema === 'claro' ? 'text-black' : 'text-white'}`}>
              InsightFlow
            </div>
            <div className={`text-sm font-medium ${tema === 'claro' ? 'text-black/80' : 'text-white/90'}`}>
              Sistema de Análise
              <br />
              de Ativos
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="login-card fade-in w-full max-w-md rounded-2xl border border-border-main bg-surface p-6 shadow-lg sm:p-8">
          <img src="/icone.png" alt="" className="login-logo mx-auto h-16 w-16" />
          <h1 className="mt-3 text-center font-display text-lg font-bold text-fg-0">InsightFlow</h1>
          <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-fg-3">
            Análise de ativos · B3 &amp; Cripto
          </p>

          <div className="mt-6">
            <h2 className="text-xl font-bold text-fg-0">{titulo}</h2>
            <p className="mt-1 text-sm text-fg-2">{subtitulo}</p>
          </div>

          <div className="mt-6">{children}</div>

          <div className="mt-5 text-center text-sm text-fg-2">{footer}</div>

          <p className="mt-5 border-t border-border-soft pt-3 text-center text-xs text-fg-3">
            Dados fictícios · versão de demonstração
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('investidor@exemplo.com');
  const [senha, setSenha] = useState('demo1234');
  const [verSenha, setVerSenha] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const navigate = useNavigate();

  const mut = useMutation({
    mutationFn: () => api.login({ email, senha }),
    onSuccess: (d) => {
      signIn(d);
      navigate('/');
    },
  });

  return (
    <AuthLayout
      titulo="Entrar"
      subtitulo="Use qualquer e-mail válido — os dados desta versão são mockados."
      footer={
        <>
          Não tem conta? <Link to="/cadastro">Criar cadastro</Link>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <div className="field-icon-wrap">
            <Mail className="field-icon" />
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="senha">Senha</label>
            <Link to="/recuperar-senha" className="text-xs font-semibold text-accent">Esqueceu a senha?</Link>
          </div>
          <div className="field-icon-wrap">
            <Lock className="field-icon" />
            <input
              id="senha"
              className="input has-toggle"
              type={verSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <button
              type="button"
              className="field-toggle"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={verSenha}
            >
              {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {mut.isError && <p className="text-xs text-down">{mut.error.message}</p>}
        <button className="btn-primary mt-2" disabled={mut.isPending}>
          {mut.isPending ? 'Autenticando…' : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  );
}

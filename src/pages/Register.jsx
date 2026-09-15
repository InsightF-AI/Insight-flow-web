import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/index.js';
import { AuthLayout } from './Login.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function forcaSenha(senha) {
  let score = 0;
  if (senha.length >= 8) score++;
  if (senha.length >= 12) score++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) score++;
  if (/\d/.test(senha) && /[^A-Za-z0-9]/.test(senha)) score++;
  return score;
}

const FORCA_LABEL = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Muito forte'];
const FORCA_COR = ['bg-down', 'bg-down', 'bg-warn', 'bg-up', 'bg-up'];

function IndicadorForca({ senha }) {
  if (!senha) return null;
  const score = forcaSenha(senha);
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < score ? FORCA_COR[score] : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-fg-3">Força da senha: {FORCA_LABEL[score]}</p>
    </div>
  );
}

export default function Register() {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmarSenha: '' });
  const [erros, setErros] = useState({});
  const [verSenha, setVerSenha] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const navigate = useNavigate();
  const mut = useMutation({
    mutationFn: () => api.register(form),
    onSuccess: (d) => {
      signIn(d);
      navigate('/');
    },
  });

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (mut.isError) mut.reset();
  };

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Informe seu nome.';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Informe um e-mail válido.';
    if (form.senha.length < 8) e.senha = 'Mínimo de 8 caracteres.';
    if (form.confirmarSenha !== form.senha) e.confirmarSenha = 'As senhas não coincidem.';
    return e;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const validacao = validar();
    setErros(validacao);
    if (Object.keys(validacao).length > 0) return;
    mut.mutate();
  };

  return (
    <AuthLayout
      titulo="Criar cadastro"
      subtitulo="Nome, e-mail e senha. O e-mail é validado como único no sistema."
      footer={
        <>
          Já tem conta? <Link to="/login">Entrar</Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        <div>
          <label className="label" htmlFor="nome">Nome</label>
          <div className="field-icon-wrap">
            <User className="field-icon" />
            <input
              id="nome"
              className={`input ${erros.nome ? 'border-down' : ''}`}
              value={form.nome}
              onChange={set('nome')}
            />
          </div>
          {erros.nome && <p className="mt-1.5 text-xs text-down">{erros.nome}</p>}
        </div>
        <div>
          <label className="label" htmlFor="email2">E-mail</label>
          <div className="field-icon-wrap">
            <Mail className="field-icon" />
            <input
              id="email2"
              className={`input ${erros.email ? 'border-down' : ''}`}
              type="email"
              value={form.email}
              onChange={set('email')}
            />
          </div>
          {erros.email && <p className="mt-1.5 text-xs text-down">{erros.email}</p>}
        </div>
        <div>
          <label className="label" htmlFor="senha2">Senha</label>
          <div className="field-icon-wrap">
            <Lock className="field-icon" />
            <input
              id="senha2"
              className={`input has-toggle ${erros.senha ? 'border-down' : ''}`}
              type={verSenha ? 'text' : 'password'}
              value={form.senha}
              onChange={set('senha')}
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
          {erros.senha ? (
            <p className="mt-1.5 text-xs text-down">{erros.senha}</p>
          ) : (
            <IndicadorForca senha={form.senha} />
          )}
        </div>
        <div>
          <label className="label" htmlFor="confirmarSenha">Confirmar senha</label>
          <div className="field-icon-wrap">
            <Lock className="field-icon" />
            <input
              id="confirmarSenha"
              className={`input ${erros.confirmarSenha ? 'border-down' : ''}`}
              type={verSenha ? 'text' : 'password'}
              value={form.confirmarSenha}
              onChange={set('confirmarSenha')}
            />
          </div>
          {erros.confirmarSenha && <p className="mt-1.5 text-xs text-down">{erros.confirmarSenha}</p>}
        </div>

        {mut.isError && (
          <div className="rounded-sm border border-down/30 bg-tone-red-bg px-3 py-2.5 text-xs text-down">
            {mut.error.message}
            {mut.error.code === 'EMAIL_EXISTS' && (
              <>
                {' '}
                <Link to="/recuperar-senha" state={{ email: form.email }} className="font-semibold underline">
                  Recuperar senha
                </Link>
              </>
            )}
          </div>
        )}

        <button className="btn-primary mt-2" disabled={mut.isPending}>
          {mut.isPending ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  );
}

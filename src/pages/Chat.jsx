import { useRef, useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, Eraser, Send, Sparkles, Terminal } from 'lucide-react';
import { api } from '../api/client.js';
import { CHAT_SUGGESTIONS } from '../api/mock/ai.js';
import { useAuthStore } from '../store/index.js';
import Disclaimer from '../components/Disclaimer.jsx';

const MENSAGEM_INICIAL = {
  role: 'ia',
  texto:
    'Posso responder sobre a sua carteira consultando os dados registrados: rentabilidade, exposição por classe e setor, comparativo com CDI e Ibovespa, histórico de operações e sinais ativos.',
  ferramentas: [],
};

/** UC-06 — chat sobre a carteira, com function calling simulado. */
export default function Chat() {
  const usuario = useAuthStore((s) => s.usuario);
  const [msgs, setMsgs] = useState([MENSAGEM_INICIAL]);
  const [texto, setTexto] = useState('');
  const [copiado, setCopiado] = useState(null);
  const listRef = useRef(null);

  const copiar = (i, texto) => {
    navigator.clipboard.writeText(texto);
    setCopiado(i);
    setTimeout(() => setCopiado((c) => (c === i ? null : c)), 1500);
  };

  const mut = useMutation({
    mutationFn: (pergunta) => api.askAI(pergunta),
    onSuccess: (r) => setMsgs((m) => [...m, { role: 'ia', texto: r.texto, ferramentas: r.ferramentas }]),
  });

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs, mut.isPending]);

  const enviar = (pergunta) => {
    const q = (pergunta ?? texto).trim();
    if (!q || mut.isPending) return;
    setMsgs((m) => [...m, { role: 'user', texto: q }]);
    setTexto('');
    mut.mutate(q);
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Chat IA</h2>
          <p className="mt-1">Respostas mockadas nesta versão. Nenhuma chamada é feita a provedor externo.</p>
        </div>
        {msgs.length > 1 && (
          <button
            onClick={() => setMsgs([MENSAGEM_INICIAL])}
            className="flex items-center gap-1.5 text-xs font-semibold text-fg-3 hover:text-down"
          >
            <Eraser size={13} /> Limpar conversa
          </button>
        )}
      </header>

      <div ref={listRef} className="card flex-1 overflow-y-auto p-4">
        <ul className="grid gap-4">
          {msgs.map((m, i) => (
            <li key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'ia' && (
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-tone-violet-bg">
                  <Sparkles size={14} className="text-purple" />
                </div>
              )}
              <div className={`max-w-[80%] ${m.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-accent text-base' : 'bg-elevated text-fg-1'
                  }`}
                >
                  {m.texto}
                </div>
                {m.ferramentas?.length > 0 && (
                  <div className="mt-2 grid gap-1">
                    {m.ferramentas.map((f) => (
                      <div key={f} className="flex items-center gap-1.5 text-[11px] text-fg-3">
                        <Terminal size={11} />
                        <code>{f}</code>
                      </div>
                    ))}
                  </div>
                )}
                {m.role === 'ia' && (
                  <button
                    onClick={() => copiar(i, m.texto)}
                    className="mt-1 flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg-1"
                  >
                    {copiado === i ? (
                      <>
                        <Check size={11} /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy size={11} /> Copiar
                      </>
                    )}
                  </button>
                )}
              </div>
              {m.role === 'user' && (
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-fg-1">
                  {usuario?.nome?.[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
            </li>
          ))}
          {mut.isPending && (
            <li className="flex gap-3">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-tone-violet-bg">
                <Sparkles size={14} className="animate-pulse text-purple" />
              </div>
              <div className="rounded-xl bg-elevated px-3.5 py-2.5 text-sm text-fg-3">
                Consultando dados da carteira…
              </div>
            </li>
          )}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        {CHAT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => enviar(s)}
            className="rounded-full border border-border-main px-3 py-1.5 text-xs text-fg-2 hover:border-accent hover:text-fg-0"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <input
          className="input"
          placeholder="Pergunte sobre a sua carteira…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="btn-primary" disabled={mut.isPending || !texto.trim()}>
          <Send size={15} />
        </button>
      </form>

      <Disclaimer />
    </div>
  );
}

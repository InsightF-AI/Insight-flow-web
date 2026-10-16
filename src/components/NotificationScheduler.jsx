import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { mapNotificacao, renovarTokens } from '../api/client.js';
import { useAuthStore, useUiStore } from '../store/index.js';
import { useToastStore } from '../store/toastStore.js';
import { notificarDisparo } from '../lib/notify.js';
import { ativarWebPush, webPushSuportado } from '../lib/webPush.js';
import { urlDoWebSocket } from '../lib/ws.js';

// Em dev o proxy do Vite repassa o WebSocket; em container, o Nginx da própria imagem.
// VITE_WS_URL só é necessária se o WebSocket tiver que sair para outra origem.
const WS_URL = urlDoWebSocket(import.meta.env.VITE_WS_URL, window.location);
const RECONEXAO_MAX_MS = 15_000;

/** RF-18/UC-07 — notificações em tempo real. Quem avalia as regras é o scheduler do backend;
 * aqui só mantemos o WebSocket aberto (via proxy do Vite) e entregamos cada notificação como
 * toast in-app + notificação nativa do navegador. Não renderiza nada visível. */
export default function NotificationScheduler() {
  const qc = useQueryClient();
  const logado = useAuthStore((s) => !!s.token);
  const token = useAuthStore((s) => s.token);
  const pushToast = useToastStore((s) => s.push);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!logado) return undefined;
    let encerrado = false;
    let tentativas = 0;
    let timer = null;

    const conectar = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ tipo: 'autenticar', token: useAuthStore.getState().token }));
      };

      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.tipo === 'autenticado') {
          tentativas = 0;
        } else if (msg.tipo === 'notificacao' && msg.notificacao) {
          const disparo = mapNotificacao(msg.notificacao);
          notificarDisparo(disparo, pushToast);
          qc.invalidateQueries({ queryKey: ['userTriggers'] });
          qc.invalidateQueries({ queryKey: ['userRules'] });
        }
        // {"tipo":"ping"} é só keep-alive do servidor — ignorado.
      };

      ws.onclose = async (ev) => {
        if (encerrado) return;
        // 4401 = token inválido/expirado: renova antes de reconectar (sem refresh válido, desloga).
        if (ev.code === 4401) {
          try {
            await renovarTokens();
          } catch {
            return;
          }
        }
        const espera = Math.min(1000 * 2 ** tentativas, RECONEXAO_MAX_MS);
        tentativas += 1;
        timer = setTimeout(conectar, espera);
      };
    };

    conectar();
    return () => {
      encerrado = true;
      clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [logado, qc, pushToast]);

  // web push ligado nas preferências e permissão já concedida: garante a inscrição deste usuário no backend.
  useEffect(() => {
    if (!logado || !webPushSuportado()) return;
    const { notificacoesPush, setFlag } = useUiStore.getState();
    if (!notificacoesPush || Notification.permission !== 'granted') return;
    ativarWebPush()
      .then(() => setFlag('webPushAtivo', true))
      .catch(() => setFlag('webPushAtivo', false));
  }, [logado]);

  // token renovado (ex: refresh após 401) — reautentica a conexão aberta sem derrubá-la.
  useEffect(() => {
    const ws = wsRef.current;
    if (token && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ tipo: 'autenticar', token }));
  }, [token]);

  return null;
}

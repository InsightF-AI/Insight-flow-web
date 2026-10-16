import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api -> backend real (Codespace, VM etc.) via servidor de dev do Vite.
// Chamadas do navegador ficam em same-origin (localhost:5173), então CORS nunca entra em
// jogo: quem repassa a requisição pro backend é o processo Node do Vite, não o navegador.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_API_URL || 'http://localhost:8000';

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: './src/teste/setup.js',
      include: ['src/**/*.test.{js,jsx}'],
      restoreMocks: true,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          // WebSocket de notificações (/api/v1/notificacoes/ws) passa pelo mesmo proxy.
          ws: true,
        },
      },
    },
  };
});

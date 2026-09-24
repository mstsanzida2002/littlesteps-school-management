import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The client always calls the API at the relative path /api.
// Dev: Vite proxies /api → the local Express server.
// Prod: Vercel rewrites /api/* → Render (see vercel.json). Same-origin keeps the
// HTTP-only refresh cookie first-party (avoids Safari/iOS third-party cookie blocking).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        // Socket.io (WebSocket upgrade). In production the client connects to VITE_SOCKET_URL
        // directly because Vercel rewrites cannot proxy WebSockets.
        '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});

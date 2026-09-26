import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * Vite's build injects the compiled stylesheet as a render-blocking `<link rel="stylesheet">`.
 * That blocks the *entire* document's first paint — including the static boot shell in
 * index.html, which is styled by its own inline <style> and doesn't need this file at all —
 * until the (often much larger, and on a slow connection much slower) CSS bundle downloads.
 * Load it non-blocking instead (preload, then swap to a stylesheet once it arrives), with a
 * <noscript> fallback for the no-JS case. React's real content still waits on it via the
 * normal cascade; only the boot shell's paint is freed from it. See CLAUDE.md, "Slow networks".
 */
function deferStylesheets() {
  return {
    name: 'littlesteps-defer-stylesheets',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(/<link rel="stylesheet"[^>]*>/g, (tag) => {
          // Attributes other than rel/href, e.g. `crossorigin` (a bare, valueless attribute).
          const rest = [...tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)]
            .slice(1) // skip the "link" tag name itself
            .filter(([, name]) => name !== 'rel' && name !== 'href')
            .map(([, name, value]) => (value === undefined ? name : `${name}="${value}"`))
            .join(' ');
          const href = tag.match(/href="([^"]+)"/)[1];
          const extra = rest ? ` ${rest}` : '';
          return (
            `<link rel="preload" as="style" href="${href}"${extra} onload="this.onload=null;this.rel='stylesheet'">` +
            `<noscript><link rel="stylesheet" href="${href}"${extra}></noscript>`
          );
        });
      },
    },
  };
}

// The client always calls the API at the relative path /api.
// Dev: Vite proxies /api → the local Express server.
// Prod: Vercel rewrites /api/* → Render (see vercel.json). Same-origin keeps the
// HTTP-only refresh cookie first-party (avoids Safari/iOS third-party cookie blocking).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss(), deferStylesheets()],
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

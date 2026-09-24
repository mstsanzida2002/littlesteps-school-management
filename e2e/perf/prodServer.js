/**
 * Serves the production build (client/dist) the way Vercel does, for the slow-network test:
 * - HTTP/2 over TLS (self-signed, made with openssl at start-up), so the page's chunks load in
 *   parallel on one connection as they do in production; without openssl it falls back to
 *   HTTP/1.1, where Chrome fetches at most 6 files at a time (a pessimistic run);
 * - hashed files under /assets: compressed (brotli, else gzip), cached for a year (immutable);
 * - everything else: the file if it exists, otherwise index.html (SPA), revalidated each time;
 * - /api and /socket.io: proxied to the E2E API (same origin, like the Vercel rewrite).
 *
 * `vite preview` sends files uncompressed with no-cache over HTTP/1.1, which would make a slow
 * 3G run measure something production never does.
 *
 *   node perf/prodServer.js   (PORT, API_PORT from the environment)
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const PORT = Number(process.env.PORT ?? 5176);
const API_PORT = Number(process.env.API_PORT ?? 5100);
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.webmanifest', '.json']);
// Hop-by-hop headers can't be sent over HTTP/2.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
]);

function proxy(req, res) {
  const headers = Object.fromEntries(
    Object.entries(req.headers).filter(([key]) => !key.startsWith(':') && !HOP_BY_HOP.has(key)),
  );
  headers.host = `localhost:${API_PORT}`;
  const upstream = http.request(
    { host: 'localhost', port: API_PORT, path: req.url, method: req.method, headers },
    (response) => {
      const out = Object.fromEntries(
        Object.entries(response.headers).filter(([key]) => !HOP_BY_HOP.has(key)),
      );
      res.writeHead(response.statusCode, out);
      response.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
}

function serveFile(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    return res.end();
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  const hashed = url.pathname.startsWith('/assets/');
  const headers = {
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    'cache-control': hashed
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate',
    vary: 'Accept-Encoding',
  };
  const accepts = req.headers['accept-encoding'] ?? '';
  let stream = createReadStream(file);
  if (COMPRESSIBLE.has(ext)) {
    if (accepts.includes('br')) {
      headers['content-encoding'] = 'br';
      stream = stream.pipe(zlib.createBrotliCompress());
    } else if (accepts.includes('gzip')) {
      headers['content-encoding'] = 'gzip';
      stream = stream.pipe(zlib.createGzip());
    }
  }
  res.writeHead(200, headers);
  stream.pipe(res);
}

const handler = (req, res) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) return proxy(req, res);
  return serveFile(req, res);
};

/** A throwaway self-signed certificate for localhost, or null without openssl. */
function selfSignedCert() {
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'littlesteps-perf-'));
    const key = path.join(dir, 'key.pem');
    const cert = path.join(dir, 'cert.pem');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-subj',
        '/CN=localhost',
        '-days',
        '1',
        '-keyout',
        key,
        '-out',
        cert,
      ],
      { stdio: 'ignore' },
    );
    return { key: readFileSync(key), cert: readFileSync(cert) };
  } catch {
    return null;
  }
}

const tls = selfSignedCert();
const server = tls
  ? http2.createSecureServer({ ...tls, allowHTTP1: true }, handler)
  : http.createServer(handler);

// WebSocket upgrades (Socket.io, over HTTP/1.1) go straight through to the API.
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(API_PORT, 'localhost', () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [key, value] of Object.entries(req.headers)) lines.push(`${key}: ${value}`);
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(PORT, () =>
  console.log(
    `Production-like client on ${tls ? 'https' : 'http'}://localhost:${PORT} (${tls ? 'HTTP/2' : 'HTTP/1.1, no openssl'})`,
  ),
);

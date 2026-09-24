/**
 * Socket.io client for real-time notifications.
 *
 * - Connects to VITE_SOCKET_URL (the API origin) in production — Vercel rewrites cannot proxy
 *   WebSockets. Empty in development: same origin, proxied by Vite.
 * - Authenticates with the in-memory ACCESS token (never cookies). `auth` is a function, so every
 *   (re)connect sends the current token.
 * - Follows tokenStore: new token → (re)connect; no token → disconnect.
 * - The server drops the socket when the access token expires; we then refresh the session and
 *   reconnect. If the socket can't connect at all, the app keeps working via polling.
 */
import { io } from 'socket.io-client';

import { tokenStore } from './tokenStore.js';

const url = import.meta.env.VITE_SOCKET_URL || undefined;

export const socket = io(url, {
  path: '/socket.io',
  autoConnect: false,
  withCredentials: false,
  auth: (cb) => cb({ token: tokenStore.get() }),
});

// Connection state for React (useSyncExternalStore).
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());
socket.on('connect', notify);
socket.on('disconnect', notify);

export const socketStatus = {
  getSnapshot: () => socket.connected,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

let refreshHandler = null;
/** Registered by the auth feature: refreshes the session (single-flight) when the token expired. */
export function setSocketRefreshHandler(fn) {
  refreshHandler = fn;
}

// The server disconnects at access-token expiry ("io server disconnect" is not auto-retried).
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect' && tokenStore.get()) refreshHandler?.().catch(() => {});
});
socket.on('connect_error', (err) => {
  if (err?.message === 'Session expired') refreshHandler?.().catch(() => {});
});

tokenStore.subscribe((token) => {
  if (!token) {
    socket.disconnect();
    return;
  }
  // Reconnect so the handshake carries the fresh token.
  if (socket.connected) socket.disconnect();
  socket.connect();
});

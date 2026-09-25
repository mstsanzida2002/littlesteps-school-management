/**
 * Socket.io real-time delivery (FR-NOT-05).
 *
 * - The browser connects DIRECTLY to the API origin (Vercel rewrites cannot proxy WebSockets):
 *   CORS is limited to CLIENT_ORIGINS, and no cookies are used.
 * - Handshake auth: `auth.token` = access token, checked exactly like HTTP `authenticate`
 *   (signature, expiry, user active, tokenVersion, no pending forced password change).
 * - Each socket joins `user:<id>` and `role:<role>`; the server emits only to those rooms.
 * - When a user's sessions are ended for a reason the user should hear (suspension, a password
 *   reset by an admin), their sockets get `session:ended { reason }` just before the disconnect.
 * - Sockets are disconnected when the access token expires (the client reconnects with a fresh
 *   one), when all sessions end (suspension, password change/reset), and on logout (that
 *   login's `sid` only).
 * - In-memory adapter: a single API instance. Several instances would need the Redis adapter.
 * - All exports are no-ops until initRealtime() runs (tests without sockets, scripts).
 */
import { Server } from 'socket.io';

import { env } from '../config/env.js';
import { userFromAccessToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { sessionEvents } from '../utils/sessionEvents.js';

let io = null;

export const userRoom = (userId) => `user:${userId}`;
export const roleRoom = (role) => `role:${role}`;

// Reasons the signed-out user is told about (a password change on another device is not news).
const ANNOUNCED_REASONS = new Set(['suspended', 'admin_reset']);
// Give the session:ended packet time to leave before the socket closes.
const DISCONNECT_DELAY_MS = 150;

function handshakeError(message, code) {
  const error = new Error(message);
  error.data = { code };
  return error;
}

async function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(handshakeError('Authentication required', 'NO_TOKEN'));
  try {
    const { user, payload } = await userFromAccessToken(token);
    if (user.mustChangePassword) {
      return next(handshakeError('Password change required', 'PASSWORD_CHANGE_REQUIRED'));
    }
    socket.data.user = user;
    socket.data.sid = payload.sid;
    socket.data.exp = payload.exp;
    return next();
  } catch (err) {
    return next(handshakeError(err.message ?? 'Unauthorized', 'UNAUTHORIZED'));
  }
}

function onConnection(socket) {
  socket.join([userRoom(socket.data.user.id), roleRoom(socket.data.user.role)]);
  // Drop the socket when its access token expires; the client reconnects with a fresh token.
  const msLeft = socket.data.exp * 1000 - Date.now();
  const timer = setTimeout(() => socket.disconnect(true), Math.max(msLeft, 0));
  timer.unref?.();
  socket.on('disconnect', () => clearTimeout(timer));
}

function onUserSessionsEnded({ userId, reason }) {
  if (!io) return;
  const room = userRoom(userId);
  if (!ANNOUNCED_REASONS.has(reason)) {
    io.in(room).disconnectSockets(true);
    return;
  }
  io.to(room).emit('session:ended', { reason });
  const timer = setTimeout(() => io?.in(room).disconnectSockets(true), DISCONNECT_DELAY_MS);
  timer.unref?.();
}

async function onSessionEnded({ userId, sid }) {
  if (!io) return;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  for (const socket of sockets) if (socket.data.sid === sid) socket.disconnect(true);
}

/** Attach Socket.io to an http.Server. */
export function initRealtime(httpServer, { origins = env.CLIENT_ORIGINS } = {}) {
  io = new Server(httpServer, {
    path: '/socket.io',
    serveClient: false,
    cors: { origin: origins, credentials: false },
  });
  io.use(authenticateSocket);
  io.on('connection', onConnection);
  sessionEvents.on('user-sessions-ended', onUserSessionsEnded);
  sessionEvents.on('session-ended', onSessionEnded);
  logger.info('Socket.io ready at /socket.io');
  return io;
}

export function closeRealtime() {
  sessionEvents.off('user-sessions-ended', onUserSessionsEnded);
  sessionEvents.off('session-ended', onSessionEnded);
  io?.close();
  io = null;
}

export const isRealtimeReady = () => io !== null;

/** Emit to a room such as roleRoom('admin') (no-op without Socket.io). */
export function emitToRoom(room, event, payload) {
  io?.to(room).emit(event, payload);
}

/** Emit to every socket of a user (no-op without Socket.io). */
export function emitToUser(userId, event, payload) {
  io?.to(userRoom(String(userId))).emit(event, payload);
}

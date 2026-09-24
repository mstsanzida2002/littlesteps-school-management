import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from '../utils/logger.js';

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;

mongoose.set('strictQuery', true);
// Fail queries fast while disconnected (503 via the error handler) instead of hanging 10 s.
mongoose.set('bufferTimeoutMS', 5_000);

let listenersAttached = false;
let retryTimer = null;

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err.message));
}

export async function connectDB(uri = env.MONGODB_URI) {
  if (!uri) {
    logger.warn('MONGODB_URI is not set — starting without a database connection.');
    return null;
  }
  attachListeners();
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

/**
 * Keep retrying the FIRST connection in the background with backoff (5 s → 60 s).
 * After a successful connect, the MongoDB driver reconnects on its own.
 * `onConnected` runs once when a connection is finally established.
 */
export function connectInBackground({ uri = env.MONGODB_URI, onConnected } = {}) {
  if (!uri) return;
  let delay = RETRY_MIN_MS;
  const attempt = async () => {
    retryTimer = null;
    try {
      await connectDB(uri);
      await onConnected?.();
    } catch (err) {
      logger.warn(`MongoDB still unavailable (${err.message}); retrying in ${delay / 1000}s`);
      retryTimer = setTimeout(attempt, delay);
      retryTimer.unref?.();
      delay = Math.min(delay * 2, RETRY_MAX_MS);
    }
  };
  retryTimer = setTimeout(attempt, delay);
  retryTimer.unref?.();
}

export async function disconnectDB() {
  if (retryTimer) clearTimeout(retryTimer);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function getDbState() {
  return READY_STATES[mongoose.connection.readyState] ?? 'unknown';
}

export const isDbConnected = () => mongoose.connection.readyState === 1;

import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from '../utils/logger.js';

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

mongoose.set('strictQuery', true);

export async function connectDB(uri = env.MONGODB_URI) {
  if (!uri) {
    logger.warn('MONGODB_URI is not set — starting without a database connection.');
    return null;
  }

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err.message));

  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function getDbState() {
  return READY_STATES[mongoose.connection.readyState] ?? 'unknown';
}

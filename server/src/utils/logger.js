import { env } from '../config/env.js';

// Minimal logger; swap for pino/winston later without touching call sites.
const silent = env.isTest;

export const logger = {
  info: (...args) => !silent && console.log('[info]', ...args),
  warn: (...args) => !silent && console.warn('[warn]', ...args),
  error: (...args) => !silent && console.error('[error]', ...args),
  debug: (...args) => env.isDev && console.debug('[debug]', ...args),
};

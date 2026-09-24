import { EventEmitter } from 'node:events';

/**
 * Decouples session invalidation (token.service) from real-time delivery (realtime/io.js):
 *  - 'user-sessions-ended' { userId }            → disconnect every socket of the user
 *  - 'session-ended'       { userId, sid }       → disconnect sockets of one login (logout)
 */
export const sessionEvents = new EventEmitter();
sessionEvents.setMaxListeners(20);

import bcrypt from 'bcryptjs';

import { env } from '../config/env.js';

/** bcrypt only uses the first 72 bytes of its input (UTF-8), so passwords are capped there. */
export const PASSWORD_MAX_BYTES = 72;

export function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

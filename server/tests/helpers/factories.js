import { User } from '../../src/models/index.js';
import { signAccessToken } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

export const DEFAULT_PASSWORD = 'Passw0rd!';

let seq = 0;

/** Create a user with a real bcrypt hash (BCRYPT_ROUNDS=4 in tests). */
export async function createUser({
  role = 'student',
  status = 'active',
  password = DEFAULT_PASSWORD,
  ...overrides
} = {}) {
  seq += 1;
  const user = await User.create({
    name: `Test ${role} ${seq}`,
    username: `${role}${seq}`,
    passwordHash: await hashPassword(password),
    role,
    status,
    ...overrides,
  });
  return user;
}

/** Access token for a user without going through /login. */
export const tokenFor = (user) => signAccessToken(user);

/** The raw `ls_rt=<value>` pair from a response's Set-Cookie header (or undefined). */
export function refreshCookieFrom(res) {
  const cookies = res.headers['set-cookie'] ?? [];
  return cookies.find((c) => c.startsWith('ls_rt='))?.split(';')[0];
}

/**
 * Temporary passwords for new accounts and resets. Meets the password policy (8+ characters, a
 * letter and a number; see server validators/auth.validator.js), easy to read aloud and copy by
 * hand from a printed slip: no look-alike characters (0/O, 1/l/I), grouped as Abcd-2345-wxyz.
 * Uses crypto.getRandomValues; the password is never stored by the app.
 */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';

function randomIndex(max, random) {
  // Rejection sampling: no modulo bias.
  const limit = Math.floor(0x100000000 / max) * max;
  let value;
  do {
    value = random();
  } while (value >= limit);
  return value % max;
}

const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** "Kmtr-4827-pqwh": 12 characters from the sets above, with a capital, digits and lowercase. */
export function generateTempPassword(random = cryptoRandom) {
  const pick = (set, n) => Array.from({ length: n }, () => set[randomIndex(set.length, random)]);
  const first = [pick(UPPER, 1), pick(LOWER, 3)].flat().join('');
  const middle = pick(DIGITS, 4).join('');
  const last = pick(LOWER, 4).join('');
  return `${first}-${middle}-${last}`;
}

/** The same rules the server applies (checked in unit tests against generated passwords). */
export function meetsPasswordPolicy(password) {
  const bytes = new TextEncoder().encode(password).length;
  return password.length >= 8 && bytes <= 72 && /\p{L}/u.test(password) && /\p{N}/u.test(password);
}

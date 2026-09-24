/**
 * Children's accounts used on this device, offered as one-tap choices on the login page
 * ("Switch child" on a shared phone). Only the username and the child's display name are kept,
 * never passwords or tokens. Student accounts only: staff don't share phones.
 *
 * A per-device convenience in localStorage: every read and write is guarded, so private mode or
 * blocked storage just means no chips.
 */
const KEY = 'littlesteps.accounts';
export const MAX_REMEMBERED = 5;

const isEntry = (entry) =>
  entry &&
  typeof entry.username === 'string' &&
  entry.username.length > 0 &&
  entry.username.length <= 64 &&
  (entry.name == null || typeof entry.name === 'string');

function read() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter(isEntry).map(({ username, name }) => ({ username, name: name ?? '' }))
      : [];
  } catch {
    return [];
  }
}

function write(entries) {
  try {
    if (entries.length) window.localStorage.setItem(KEY, JSON.stringify(entries));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Not saved: the login page simply won't offer this account.
  }
}

/** [{ username, name }], most recent first. */
export const rememberedAccounts = () => read();

/** Remember (or move to the front) a child's account. */
export function rememberAccount({ username, name }) {
  if (!username) return;
  const entry = { username: String(username).toLowerCase(), name: String(name ?? '').slice(0, 60) };
  const rest = read().filter((e) => e.username !== entry.username);
  write([entry, ...rest].slice(0, MAX_REMEMBERED));
}

/** "Remove from this device": the username and the name both go. */
export function forgetAccount(username) {
  write(read().filter((e) => e.username !== String(username).toLowerCase()));
}

/**
 * Access token lives ONLY in memory (never localStorage/sessionStorage) to limit XSS impact.
 * The refresh token is an HTTP-only cookie set by the server and is invisible to JS.
 * On page reload the access token is gone; the auth feature restores it via /api/auth/refresh.
 */
let accessToken = null;
const listeners = new Set();

export const tokenStore = {
  get: () => accessToken,
  set(token) {
    accessToken = token;
    listeners.forEach((listener) => listener(accessToken));
  },
  clear() {
    tokenStore.set(null);
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

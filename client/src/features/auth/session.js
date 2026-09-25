/**
 * Client session: the single source of truth for "who is signed in".
 *
 * - Access token: memory only (lib/tokenStore.js). Refresh token: HTTP-only cookie (invisible).
 * - refreshSession() is single-flight and shared by app start-up and the Axios 401 retry, so
 *   React StrictMode double effects and parallel 401s cause exactly one POST /auth/refresh.
 * - A failed refresh clears LOCAL state only. POST /auth/logout is called only by an explicit
 *   user logout: calling it after losing a multi-tab refresh race would revoke the cookie the
 *   winning tab just received and sign out every tab.
 * - Explicit logout is broadcast to other tabs ("littlesteps-auth" BroadcastChannel).
 */
import { queryClient } from '../../app/queryClient.js';
import { setRefreshHandler } from '../../lib/axios.js';
import { setSocketRefreshHandler, socket } from '../../lib/socket.js';
import { tokenStore } from '../../lib/tokenStore.js';
import { authApi } from './api/authApi.js';

export const AUTH_STATUS = Object.freeze({
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous',
});

// --- Store (read with useAuth via useSyncExternalStore) ----------------------

let state = { status: AUTH_STATUS.LOADING, user: null };
const listeners = new Set();

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export const sessionStore = {
  getSnapshot: () => state,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function startSession({ accessToken, user }) {
  tokenStore.set(accessToken);
  setState({ status: AUTH_STATUS.AUTHENTICATED, user });
}

/** Forget the session in this tab only (token, cached server data, auth state). */
function clearLocalSession() {
  tokenStore.clear();
}

// Whenever the token disappears (failed refresh, logout, another tab's logout), drop all cached
// server data — on a shared phone the next person must never see the previous child's data.
tokenStore.subscribe((token) => {
  if (token) return;
  queryClient.clear();
  if (state.status !== AUTH_STATUS.ANONYMOUS)
    setState({ status: AUTH_STATUS.ANONYMOUS, user: null });
});

// --- Signed out by the school ----------------------------------------------------

// The server says why just before it ends the sessions (suspension, a password reset by an
// admin). Sign out here at once and keep the reason for the login page (read, then cleared).
let endedReason = null;
export const sessionEndedReason = () => endedReason;
export function clearSessionEndedReason() {
  endedReason = null;
}
socket.on('session:ended', ({ reason } = {}) => {
  endedReason = reason ?? null;
  clearLocalSession();
});

// --- Cross-tab logout ----------------------------------------------------------

const CHANNEL_NAME = 'littlesteps-auth';
let channel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === 'logout') clearLocalSession();
    };
  }
} catch {
  channel = null; // unsupported: other tabs find out on their next refresh
}

// --- Refresh -------------------------------------------------------------------

const REFRESH_RETRY_DELAY_MS = 400;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runRefresh() {
  let session;
  try {
    session = await authApi.refresh();
  } catch (err) {
    // Retry only when another tab rotated the cookie a moment ago (server grace window): the
    // browser now holds the newer cookie, so one retry succeeds. NO_SESSION / SESSION_INVALID
    // fail immediately (no delay for signed-out visitors).
    if (err?.code !== 'TOKEN_ROTATED') throw err;
    await sleep(REFRESH_RETRY_DELAY_MS);
    session = await authApi.refresh();
  }
  startSession(session);
  return session.accessToken;
}

let inFlight = null;

/** Refresh the session once, however many callers ask at the same time. Resolves to the token. */
export function refreshSession() {
  inFlight ??= runRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

setRefreshHandler(refreshSession);
setSocketRefreshHandler(refreshSession);

let bootstrapped = false;

/** Called once on app load: restore the session from the refresh cookie, if any. */
export function bootstrapSession() {
  if (bootstrapped) return;
  bootstrapped = true;
  refreshSession().catch(clearLocalSession);
}

// --- Actions -------------------------------------------------------------------

export async function login(credentials) {
  const session = await authApi.login(credentials);
  startSession(session);
  return session.user;
}

/**
 * Change the password. The server ends every other session and returns a fresh one for this
 * device (with mustChangePassword cleared), so the user stays signed in here.
 */
export async function changePassword(body) {
  const session = await authApi.changePassword(body);
  startSession(session);
  return session.user;
}

/** Explicit user logout: revoke on the server, clear this tab, tell the other tabs. */
export async function logout() {
  try {
    await authApi.logout();
  } catch {
    // Still sign out locally if the network call fails.
  }
  clearLocalSession();
  try {
    channel?.postMessage({ type: 'logout' });
  } catch {
    // ignore
  }
}

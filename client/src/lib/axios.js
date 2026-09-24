import axios from 'axios';

import { tokenStore } from './tokenStore.js';

/**
 * Single Axios instance for the whole app. Components never import axios directly —
 * they use feature api/ functions wrapped in TanStack Query hooks.
 *
 * baseURL is always the relative '/api' (Vite proxy in dev, Vercel rewrite in prod).
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Normalized error thrown by every API call. */
export class ApiClientError extends Error {
  constructor({ message, status, code, errors, details, cause }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    /** Machine-readable server code, e.g. 'PASSWORD_CHANGE_REQUIRED' (branch on this, not message). */
    this.code = code;
    this.errors = errors;
    this.details = details;
    this.cause = cause;
  }
}

// --- Request: attach in-memory access token --------------------------------
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Response: unwrap envelope, refresh on 401, normalize errors -----------

/**
 * The auth feature (features/auth/session.js) registers a function that refreshes the
 * session and returns the new access token (or throws). It is itself single-flight and shared
 * with the app-load refresh, so parallel 401s — and app start-up — trigger one refresh.
 */
let refreshHandler = null;
let refreshPromise = null;

export function setRefreshHandler(fn) {
  refreshHandler = fn;
}

const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

api.interceptors.response.use(
  // Resolve with the server envelope: { success, message, data, meta? }
  (response) => response.data,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (
      status === 401 &&
      refreshHandler &&
      original &&
      !original._retry &&
      !NO_REFRESH_PATHS.some((path) => original.url?.startsWith(path))
    ) {
      original._retry = true;
      try {
        // Single-flight: concurrent 401s share one refresh request.
        refreshPromise ??= refreshHandler().finally(() => {
          refreshPromise = null;
        });
        const newToken = await refreshPromise;
        tokenStore.set(newToken);
        return api(original);
      } catch (refreshError) {
        // Only a definitive "session invalid" ends the session locally — never on a network
        // blip. This clears local state only; it never calls POST /auth/logout.
        if (refreshError?.status === 401 || refreshError?.status === 403) tokenStore.clear();
        // Fall through to the normalized 401 below.
      }
    }

    return Promise.reject(toApiClientError(error));
  },
);

function toApiClientError(error) {
  if (error.response) {
    const { status, data } = error.response;
    return new ApiClientError({
      status,
      message: data?.message || `Request failed with status ${status}`,
      code: data?.code,
      errors: data?.errors,
      details: data?.details,
      cause: error,
    });
  }
  if (error.code === 'ECONNABORTED') {
    return new ApiClientError({ status: 0, message: 'The request timed out', cause: error });
  }
  return new ApiClientError({
    status: 0,
    message: 'Cannot reach the server. Check your internet connection.',
    cause: error,
  });
}

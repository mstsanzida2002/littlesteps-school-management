import { useSyncExternalStore } from 'react';

import { AUTH_STATUS, logout, sessionStore } from '../session.js';

/** { status, user, isAuthenticated, logout } */
export function useAuth() {
  const { status, user } = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
  return { status, user, isAuthenticated: status === AUTH_STATUS.AUTHENTICATED, logout };
}

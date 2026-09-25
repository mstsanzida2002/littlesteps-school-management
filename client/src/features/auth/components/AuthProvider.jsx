import { useEffect } from 'react';

import { AppShellSkeleton } from '../../../components/layout/AppShellSkeleton.jsx';
import { FullPageLoader } from '../../../components/ui/FullPageLoader.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { AUTH_STATUS, bootstrapSession } from '../session.js';

/**
 * Silently restores the session on app load; shows a loading screen until that finishes: the
 * page-shaped shell on signed-in pages, the logo on /login and / (the same choice index.html's
 * inline script made for the first paint, in data-boot).
 */
export default function AuthProvider({ children }) {
  const { status } = useAuth();

  useEffect(() => {
    bootstrapSession();
  }, []);

  if (status === AUTH_STATUS.LOADING) {
    return document.documentElement.dataset.boot === 'shell' ? (
      <AppShellSkeleton />
    ) : (
      <FullPageLoader label="Signing you in…" />
    );
  }
  return children;
}

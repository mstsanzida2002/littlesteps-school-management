import { useEffect } from 'react';

import { FullPageLoader } from '../../../components/ui/FullPageLoader.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { AUTH_STATUS, bootstrapSession } from '../session.js';

/** Silently restores the session on app load; shows a loading screen until that finishes. */
export default function AuthProvider({ children }) {
  const { status } = useAuth();

  useEffect(() => {
    bootstrapSession();
  }, []);

  if (status === AUTH_STATUS.LOADING) return <FullPageLoader label="Signing you in…" />;
  return children;
}

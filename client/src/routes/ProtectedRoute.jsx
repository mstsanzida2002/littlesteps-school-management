import { Navigate, Outlet, useLocation } from 'react-router';

import { AppShellSkeleton } from '../components/layout/AppShellSkeleton.jsx';
import { ROUTES } from '../config/constants.js';
import { useAuth } from '../features/auth/hooks/useAuth.js';
import { AUTH_STATUS } from '../features/auth/session.js';

/**
 * Gate for any signed-in area; remembers where the user was going. Users who must change their
 * password can only reach the change-password page (the API enforces the same rule).
 */
export default function ProtectedRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  // Same shape as index.html's placeholder, so the page doesn't jump while the session loads.
  if (status === AUTH_STATUS.LOADING) return <AppShellSkeleton />;
  if (status !== AUTH_STATUS.AUTHENTICATED) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }
  if (user.mustChangePassword && location.pathname !== ROUTES.CHANGE_PASSWORD) {
    return <Navigate to={ROUTES.CHANGE_PASSWORD} replace />;
  }
  return <Outlet />;
}

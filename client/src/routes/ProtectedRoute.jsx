import { Navigate, Outlet, useLocation } from 'react-router';

import { FullPageLoader } from '../components/ui/FullPageLoader.jsx';
import { ROUTES } from '../config/constants.js';
import { useAuth } from '../features/auth/hooks/useAuth.js';
import { AUTH_STATUS } from '../features/auth/session.js';

/** Gate for any signed-in area; remembers where the user was going. */
export default function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === AUTH_STATUS.LOADING) return <FullPageLoader />;
  if (status !== AUTH_STATUS.AUTHENTICATED) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }
  return <Outlet />;
}

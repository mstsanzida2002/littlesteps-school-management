import { Navigate, Outlet } from 'react-router';

import { ROLE_HOME, ROUTES } from '../config/constants.js';
import { useAuth } from '../features/auth/hooks/useAuth.js';

/**
 * Restricts a subtree to the given roles; others go to their own dashboard.
 * UI convenience only — the API enforces RBAC.
 */
export default function RoleRoute({ roles }) {
  const { user } = useAuth();

  if (!user) return <Navigate to={ROUTES.LOGIN} replace />;
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}

import { Outlet } from 'react-router';

/**
 * Gate for any authenticated area.
 * TODO(auth): if there is no session, try a silent refresh; on failure
 * <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />.
 * Currently a pass-through so the routing shape is fixed before auth exists.
 */
export default function ProtectedRoute() {
  return <Outlet />;
}

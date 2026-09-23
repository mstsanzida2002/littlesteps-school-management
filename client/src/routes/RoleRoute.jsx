import { Outlet } from 'react-router';

/**
 * Restricts a subtree to the given roles. UI-only convenience — the API enforces RBAC.
 * TODO(auth): if the current user's role is not in `roles`, redirect to ROLE_HOME[user.role].
 */
// eslint-disable-next-line no-unused-vars
export default function RoleRoute({ roles }) {
  return <Outlet />;
}

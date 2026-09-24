import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';

import { NAV_ITEMS, ROLES, ROUTES } from '../config/constants.js';
import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import PublicLayout from '../layouts/PublicLayout.jsx';
import ErrorPage from '../pages/ErrorPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import ProtectedRoute from '../routes/ProtectedRoute.jsx';
import RoleRoute from '../routes/RoleRoute.jsx';

// Pages are code-split; layouts wrap <Outlet /> in <Suspense>.
const HomePage = lazy(() => import('../pages/HomePage.jsx'));
const ComingSoonPage = lazy(() => import('../pages/ComingSoonPage.jsx'));
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage.jsx'));
const ChangePasswordPage = lazy(() => import('../features/auth/pages/ChangePasswordPage.jsx'));
const AdminDashboardPage = lazy(() => import('../features/admin/pages/AdminDashboardPage.jsx'));
const TeacherDashboardPage = lazy(
  () => import('../features/teacher/pages/TeacherDashboardPage.jsx'),
);
const StudentDashboardPage = lazy(
  () => import('../features/student/pages/StudentDashboardPage.jsx'),
);

// Development only: `import.meta.env.DEV` is false in production builds, so this branch and the
// styleguide chunk are removed from the bundle entirely.
const styleguideRoutes = import.meta.env.DEV
  ? [
      {
        path: ROUTES.STYLEGUIDE,
        lazy: async () => ({
          Component: (await import('../dev/styleguide/StyleguidePage.jsx')).default,
        }),
      },
    ]
  : [];

/** Nav items whose feature isn't built yet show a "coming soon" page. */
const comingSoon = (role) =>
  NAV_ITEMS[role]
    .filter((item) => !item.end)
    .map((item) => ({ path: item.to, element: <ComingSoonPage title={item.label} /> }));

/** Role area: auth gate → role gate → dashboard shell → feature pages. */
const roleArea = (role, path, children) => ({
  element: <RoleRoute roles={[role]} />,
  children: [
    {
      path,
      element: <DashboardLayout role={role} />,
      children: [...children, ...comingSoon(role)],
    },
  ],
});

export const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [{ path: ROUTES.HOME, element: <HomePage /> }],
      },
      {
        element: <AuthLayout />,
        children: [{ path: ROUTES.LOGIN, element: <LoginPage /> }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [{ path: ROUTES.CHANGE_PASSWORD, element: <ChangePasswordPage /> }],
          },
          roleArea(ROLES.ADMIN, ROUTES.ADMIN, [{ index: true, element: <AdminDashboardPage /> }]),
          roleArea(ROLES.TEACHER, ROUTES.TEACHER, [
            { index: true, element: <TeacherDashboardPage /> },
          ]),
          roleArea(ROLES.STUDENT, ROUTES.STUDENT, [
            { index: true, element: <StudentDashboardPage /> },
          ]),
        ],
      },
      ...styleguideRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

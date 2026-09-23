import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';

import { ROLES, ROUTES } from '../config/constants.js';
import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import PublicLayout from '../layouts/PublicLayout.jsx';
import ErrorPage from '../pages/ErrorPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import ProtectedRoute from '../routes/ProtectedRoute.jsx';
import RoleRoute from '../routes/RoleRoute.jsx';

// Pages are code-split; layouts wrap <Outlet /> in <Suspense>.
const HomePage = lazy(() => import('../pages/HomePage.jsx'));
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage.jsx'));
const AdminDashboardPage = lazy(() => import('../features/admin/pages/AdminDashboardPage.jsx'));
const TeacherDashboardPage = lazy(
  () => import('../features/teacher/pages/TeacherDashboardPage.jsx'),
);
const StudentDashboardPage = lazy(
  () => import('../features/student/pages/StudentDashboardPage.jsx'),
);

/** Role area: auth gate → role gate → dashboard shell → feature pages. */
const roleArea = (role, path, children) => ({
  element: <RoleRoute roles={[role]} />,
  children: [{ path, element: <DashboardLayout role={role} />, children }],
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
          roleArea(ROLES.ADMIN, ROUTES.ADMIN, [{ index: true, element: <AdminDashboardPage /> }]),
          roleArea(ROLES.TEACHER, ROUTES.TEACHER, [
            { index: true, element: <TeacherDashboardPage /> },
          ]),
          roleArea(ROLES.STUDENT, ROUTES.STUDENT, [
            { index: true, element: <StudentDashboardPage /> },
          ]),
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

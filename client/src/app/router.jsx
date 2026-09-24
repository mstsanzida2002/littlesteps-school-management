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
const NotificationsPage = lazy(
  () => import('../features/notifications/pages/NotificationsPage.jsx'),
);
const NoticesPage = lazy(() => import('../features/notices/pages/NoticesPage.jsx'));

// Teacher screens
const TakeAttendancePage = lazy(() => import('../features/teacher/pages/TakeAttendancePage.jsx'));
const AttendanceRecordsPage = lazy(
  () => import('../features/teacher/pages/AttendanceRecordsPage.jsx'),
);
const AttendanceSummaryPage = lazy(
  () => import('../features/teacher/pages/AttendanceSummaryPage.jsx'),
);
const StudentAttendancePage = lazy(
  () => import('../features/teacher/pages/StudentAttendancePage.jsx'),
);
const AssessmentsPage = lazy(() => import('../features/teacher/pages/AssessmentsPage.jsx'));
const AssessmentFormPage = lazy(() => import('../features/teacher/pages/AssessmentFormPage.jsx'));
const ResultEntryPage = lazy(() => import('../features/teacher/pages/ResultEntryPage.jsx'));
const MeetingsPage = lazy(() => import('../features/teacher/pages/MeetingsPage.jsx'));
const MeetingFormPage = lazy(() => import('../features/teacher/pages/MeetingFormPage.jsx'));
const MeetingDetailPage = lazy(() => import('../features/teacher/pages/MeetingDetailPage.jsx'));

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

/** Nav items without a page of their own yet show a "coming soon" page. */
const comingSoon = (role, base, children) => {
  const built = new Set(children.filter((c) => c.path).map((c) => `${base}/${c.path}`));
  return NAV_ITEMS[role]
    .filter((item) => !item.end && !built.has(item.to))
    .map((item) => ({ path: item.to, element: <ComingSoonPage title={item.label} /> }));
};

/** Every role has the notifications page (the bell links to it). */
const notifications = { path: 'notifications', element: <NotificationsPage /> };

/** Role area: auth gate → role gate → dashboard shell → feature pages. */
const roleArea = (role, path, pages) => {
  const children = [...pages, notifications];
  return {
    element: <RoleRoute roles={[role]} />,
    children: [
      {
        path,
        element: <DashboardLayout role={role} />,
        children: [...children, ...comingSoon(role, path, children)],
      },
    ],
  };
};

const teacherPages = [
  { index: true, element: <TeacherDashboardPage /> },
  { path: 'attendance', element: <TakeAttendancePage /> },
  { path: 'attendance/records', element: <AttendanceRecordsPage /> },
  { path: 'attendance/summary', element: <AttendanceSummaryPage /> },
  { path: 'students/:studentId/attendance', element: <StudentAttendancePage /> },
  { path: 'results', element: <AssessmentsPage /> },
  { path: 'results/new', element: <AssessmentFormPage /> },
  { path: 'results/:assessmentId', element: <ResultEntryPage /> },
  { path: 'results/:assessmentId/edit', element: <AssessmentFormPage /> },
  { path: 'meetings', element: <MeetingsPage /> },
  { path: 'meetings/new', element: <MeetingFormPage /> },
  { path: 'meetings/:meetingId', element: <MeetingDetailPage /> },
  { path: 'meetings/:meetingId/edit', element: <MeetingFormPage /> },
  { path: 'notices', element: <NoticesPage /> },
];

const studentPages = [
  { index: true, element: <StudentDashboardPage /> },
  // Read-only and the same for every role; the rest of the student screens come next.
  { path: 'notices', element: <NoticesPage /> },
];

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
          roleArea(ROLES.TEACHER, ROUTES.TEACHER, teacherPages),
          roleArea(ROLES.STUDENT, ROUTES.STUDENT, studentPages),
        ],
      },
      ...styleguideRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

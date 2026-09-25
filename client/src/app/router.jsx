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

// Admin screens (the shared ones reuse the teacher pages, role-aware)
const UsersPage = lazy(() => import('../features/admin/pages/UsersPage.jsx'));
const UserCreatePage = lazy(() => import('../features/admin/pages/UserCreatePage.jsx'));
const UserDetailPage = lazy(() => import('../features/admin/pages/UserDetailPage.jsx'));
const UserEditPage = lazy(() => import('../features/admin/pages/UserEditPage.jsx'));
const ApprovalsPage = lazy(() => import('../features/admin/pages/ApprovalsPage.jsx'));
const StructurePage = lazy(() => import('../features/admin/pages/StructurePage.jsx'));
const AssignmentsPage = lazy(() => import('../features/admin/pages/AssignmentsPage.jsx'));
const SettingsPage = lazy(() => import('../features/admin/pages/SettingsPage.jsx'));
const AdminAttendancePage = lazy(() => import('../features/admin/pages/AdminAttendancePage.jsx'));
const AdminNoticesPage = lazy(() => import('../features/admin/pages/AdminNoticesPage.jsx'));
const NoticeFormPage = lazy(() => import('../features/admin/pages/NoticeFormPage.jsx'));
const AuditLogPage = lazy(() => import('../features/admin/pages/AuditLogPage.jsx'));

// Student (guardian) screens
const ChildAttendancePage = lazy(() => import('../features/student/pages/ChildAttendancePage.jsx'));
const ChildResultsPage = lazy(() => import('../features/student/pages/ChildResultsPage.jsx'));
const ChildResultPage = lazy(() => import('../features/student/pages/ChildResultPage.jsx'));
const ChildMeetingsPage = lazy(() => import('../features/student/pages/ChildMeetingsPage.jsx'));
const ChildMeetingPage = lazy(() => import('../features/student/pages/ChildMeetingPage.jsx'));
const ChildProfilePage = lazy(() => import('../features/student/pages/ChildProfilePage.jsx'));
const ChildNotFound = lazy(() => import('../features/student/components/ChildNotFound.jsx'));

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

const adminPages = [
  { index: true, element: <AdminDashboardPage /> },
  { path: 'users', element: <UsersPage /> },
  { path: 'users/new', element: <UserCreatePage /> },
  { path: 'users/:userId', element: <UserDetailPage /> },
  { path: 'users/:userId/edit', element: <UserEditPage /> },
  { path: 'registrations', element: <ApprovalsPage /> },
  { path: 'classes', element: <StructurePage /> },
  { path: 'assignments', element: <AssignmentsPage /> },
  { path: 'attendance', element: <AdminAttendancePage /> },
  { path: 'students/:studentId/attendance', element: <StudentAttendancePage /> },
  { path: 'results', element: <AssessmentsPage /> },
  { path: 'results/new', element: <AssessmentFormPage /> },
  { path: 'results/:assessmentId', element: <ResultEntryPage /> },
  { path: 'results/:assessmentId/edit', element: <AssessmentFormPage /> },
  { path: 'meetings', element: <MeetingsPage /> },
  { path: 'meetings/new', element: <MeetingFormPage /> },
  { path: 'meetings/:meetingId', element: <MeetingDetailPage /> },
  { path: 'meetings/:meetingId/edit', element: <MeetingFormPage /> },
  { path: 'notices', element: <AdminNoticesPage /> },
  { path: 'notices/new', element: <NoticeFormPage /> },
  { path: 'notices/:noticeId/edit', element: <NoticeFormPage /> },
  { path: 'settings', element: <SettingsPage /> },
  { path: 'audit-log', element: <AuditLogPage /> },
];

const studentPages = [
  { index: true, element: <StudentDashboardPage /> },
  { path: 'attendance', element: <ChildAttendancePage /> },
  { path: 'results', element: <ChildResultsPage /> },
  { path: 'results/:assessmentId', element: <ChildResultPage /> },
  { path: 'meetings', element: <ChildMeetingsPage /> },
  { path: 'meetings/:meetingId', element: <ChildMeetingPage /> },
  { path: 'notices', element: <NoticesPage /> },
  { path: 'profile', element: <ChildProfilePage /> },
  // Any other address (a typo, an old link) stays inside the shell, in friendly words.
  { path: '*', element: <ChildNotFound /> },
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
          roleArea(ROLES.ADMIN, ROUTES.ADMIN, adminPages),
          roleArea(ROLES.TEACHER, ROUTES.TEACHER, teacherPages),
          roleArea(ROLES.STUDENT, ROUTES.STUDENT, studentPages),
        ],
      },
      ...styleguideRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

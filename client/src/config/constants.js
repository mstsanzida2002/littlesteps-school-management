import {
  Award,
  CalendarCheck,
  ClipboardList,
  House,
  LayoutDashboard,
  Megaphone,
  School,
  ScrollText,
  Settings,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'LittleSteps';

export const SCHOOL_TIMEZONE = 'Asia/Dhaka';

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
});

/** How roles are named to people. Students' accounts are used by their guardians. */
export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.STUDENT]: 'Guardian',
});

export const ROUTES = Object.freeze({
  HOME: '/',
  LOGIN: '/login',
  CHANGE_PASSWORD: '/change-password',
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
  STYLEGUIDE: '/styleguide',
});

/** Landing route per role after login. */
export const ROLE_HOME = Object.freeze({
  [ROLES.ADMIN]: ROUTES.ADMIN,
  [ROLES.TEACHER]: ROUTES.TEACHER,
  [ROLES.STUDENT]: ROUTES.STUDENT,
});

/**
 * Navigation per role: the desktop sidebar shows all items; the phone's bottom bar shows the
 * `primary` ones (at most 4) plus "More". Paths without a page yet show a "coming soon" page
 * (app/router.jsx) until their feature is built.
 */
export const NAV_ITEMS = Object.freeze({
  [ROLES.ADMIN]: [
    { label: 'Dashboard', to: ROUTES.ADMIN, icon: LayoutDashboard, end: true, primary: true },
    { label: 'Users', to: '/admin/users', icon: Users, primary: true },
    { label: 'Registrations', to: '/admin/registrations', icon: UserPlus },
    { label: 'Classes', to: '/admin/classes', icon: School },
    { label: 'Assignments', to: '/admin/assignments', icon: ClipboardList },
    { label: 'Attendance', to: '/admin/attendance', icon: CalendarCheck, primary: true },
    { label: 'Results', to: '/admin/results', icon: Award },
    { label: 'Meetings', to: '/admin/meetings', icon: UsersRound },
    { label: 'Notices', to: '/admin/notices', icon: Megaphone, primary: true },
    { label: 'Settings', to: '/admin/settings', icon: Settings },
    { label: 'Audit log', to: '/admin/audit-log', icon: ScrollText },
  ],
  [ROLES.TEACHER]: [
    { label: 'Dashboard', to: ROUTES.TEACHER, icon: LayoutDashboard, end: true, primary: true },
    { label: 'Attendance', to: '/teacher/attendance', icon: CalendarCheck, primary: true },
    { label: 'Results', to: '/teacher/results', icon: Award, primary: true },
    { label: 'Meetings', to: '/teacher/meetings', icon: UsersRound, primary: true },
    { label: 'Notices', to: '/teacher/notices', icon: Megaphone },
  ],
  [ROLES.STUDENT]: [
    { label: 'Home', to: ROUTES.STUDENT, icon: House, end: true, primary: true },
    { label: 'Attendance', to: '/student/attendance', icon: CalendarCheck, primary: true },
    { label: 'Results', to: '/student/results', icon: Award, primary: true },
    { label: 'Meetings', to: '/student/meetings', icon: UsersRound, primary: true },
    { label: 'Notices', to: '/student/notices', icon: Megaphone },
  ],
});

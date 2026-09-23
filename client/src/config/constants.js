export const APP_NAME = import.meta.env.VITE_APP_NAME || 'LittleSteps';

export const SCHOOL_TIMEZONE = 'Asia/Dhaka';

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
});

export const ROUTES = Object.freeze({
  HOME: '/',
  LOGIN: '/login',
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
});

/** Landing route per role after login. */
export const ROLE_HOME = Object.freeze({
  [ROLES.ADMIN]: ROUTES.ADMIN,
  [ROLES.TEACHER]: ROUTES.TEACHER,
  [ROLES.STUDENT]: ROUTES.STUDENT,
});

/** Sidebar navigation per role. Extend as features are built. */
export const NAV_ITEMS = Object.freeze({
  [ROLES.ADMIN]: [{ label: 'Dashboard', to: ROUTES.ADMIN, end: true }],
  [ROLES.TEACHER]: [{ label: 'Dashboard', to: ROUTES.TEACHER, end: true }],
  [ROLES.STUDENT]: [{ label: 'Dashboard', to: ROUTES.STUDENT, end: true }],
});

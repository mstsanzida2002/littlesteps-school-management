/**
 * URL builders for screens that take parameters, and where each notification leads. Keep URLs
 * here so links (dashboards, notifications, toasts) and routes stay in step.
 */
import { ROLES, ROLE_HOME } from './constants.js';

const withQuery = (path, params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
  return query ? `${path}?${query}` : path;
};

export const teacherPaths = {
  dashboard: () => '/teacher',
  takeAttendance: ({ classId, sectionId, date } = {}) =>
    withQuery('/teacher/attendance', { classId, sectionId, date }),
  attendanceRecords: ({ classId, sectionId, date } = {}) =>
    withQuery('/teacher/attendance/records', { classId, sectionId, date }),
  attendanceSummary: ({ classId, sectionId, from, to, subjectId } = {}) =>
    withQuery('/teacher/attendance/summary', { classId, sectionId, from, to, subjectId }),
  studentAttendance: (studentId) => `/teacher/students/${studentId}/attendance`,
  assessments: ({ status } = {}) => withQuery('/teacher/results', { status }),
  newAssessment: () => '/teacher/results/new',
  assessment: (id) => `/teacher/results/${id}`,
  editAssessment: (id) => `/teacher/results/${id}/edit`,
  meetings: ({ when } = {}) => withQuery('/teacher/meetings', { when }),
  newMeeting: () => '/teacher/meetings/new',
  meeting: (id) => `/teacher/meetings/${id}`,
  editMeeting: (id) => `/teacher/meetings/${id}/edit`,
  notices: () => '/teacher/notices',
};

/**
 * The admin area. Shared screens (attendance records, results, meetings) take the same keys as
 * teacherPaths, so one page works for both roles through useRolePaths().
 */
export const adminPaths = {
  dashboard: () => '/admin',
  users: ({ role, status, classId, sectionId, search, page } = {}) =>
    withQuery('/admin/users', { role, status, classId, sectionId, search, page }),
  newUser: ({ role } = {}) => withQuery('/admin/users/new', { role }),
  user: (id) => `/admin/users/${id}`,
  editUser: (id) => `/admin/users/${id}/edit`,
  approvals: () => '/admin/registrations',
  structure: ({ tab } = {}) => withQuery('/admin/classes', { tab }),
  assignments: ({ view, teacherId, classId, sectionId } = {}) =>
    withQuery('/admin/assignments', { view, teacherId, classId, sectionId }),
  settings: () => '/admin/settings',
  auditLog: (params = {}) => withQuery('/admin/audit-log', params),
  // Shared with teachers (same keys as teacherPaths).
  attendanceRecords: ({ classId, sectionId, date } = {}) =>
    withQuery('/admin/attendance', { classId, sectionId, date }),
  studentAttendance: (studentId) => `/admin/students/${studentId}/attendance`,
  assessments: ({ status } = {}) => withQuery('/admin/results', { status }),
  newAssessment: () => '/admin/results/new',
  assessment: (id) => `/admin/results/${id}`,
  editAssessment: (id) => `/admin/results/${id}/edit`,
  meetings: ({ when } = {}) => withQuery('/admin/meetings', { when }),
  newMeeting: () => '/admin/meetings/new',
  meeting: (id) => `/admin/meetings/${id}`,
  editMeeting: (id) => `/admin/meetings/${id}/edit`,
  notices: () => '/admin/notices',
  newNotice: () => '/admin/notices/new',
  editNotice: (id) => `/admin/notices/${id}/edit`,
};

export const studentPaths = {
  dashboard: () => '/student',
  attendance: ({ month, day } = {}) =>
    withQuery('/student/attendance', { month: month ?? day?.slice(0, 7), day }),
  results: ({ view } = {}) => withQuery('/student/results', { view }),
  result: (assessmentId) => `/student/results/${assessmentId}`,
  meetings: ({ when } = {}) => withQuery('/student/meetings', { when }),
  meeting: (id) => `/student/meetings/${id}`,
  notices: () => '/student/notices',
  notifications: () => '/student/notifications',
  profile: () => '/student/profile',
};

export const notificationsPath = (role) => `${ROLE_HOME[role] ?? ''}/notifications`;

const id = (notification, key) =>
  notification.data?.[key] ??
  (notification.relatedEntity?.kind?.toLowerCase() === key.replace(/Id$/, '')
    ? notification.relatedEntity.id
    : undefined);

/**
 * The screen a notification is about, for the signed-in role. Screens that are not built yet
 * (the admin pages) are "coming soon" routes, so the link still lands somewhere sensible.
 */
export function notificationLink(notification, role) {
  const home = ROLE_HOME[role] ?? '/';
  const type = notification?.type ?? '';

  if (type.startsWith('meeting_')) {
    const meetingId = id(notification, 'meetingId');
    if (meetingId && !notification.data?.removed) {
      if (role === ROLES.TEACHER) return teacherPaths.meeting(meetingId);
      if (role === ROLES.STUDENT) return studentPaths.meeting(meetingId);
    }
    return `${home}/meetings`;
  }
  if (type === 'notice') return `${home}/notices`;
  if (type.startsWith('result_')) {
    const assessmentId = notification.data?.assessmentId;
    if (role === ROLES.STUDENT && assessmentId) return studentPaths.result(assessmentId);
    return `${home}/results`;
  }
  if (['absence', 'attendance_corrected', 'low_attendance'].includes(type)) {
    const day = notification.data?.date;
    if (role === ROLES.STUDENT) return studentPaths.attendance({ day });
    return `${home}/attendance`;
  }
  return home;
}

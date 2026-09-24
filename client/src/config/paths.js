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

export const notificationsPath = (role) => `${ROLE_HOME[role] ?? ''}/notifications`;

const id = (notification, key) =>
  notification.data?.[key] ??
  (notification.relatedEntity?.kind?.toLowerCase() === key.replace(/Id$/, '')
    ? notification.relatedEntity.id
    : undefined);

/**
 * The screen a notification is about, for the signed-in role. Screens that are not built yet
 * (the student pages) are "coming soon" routes, so the link still lands somewhere sensible.
 */
export function notificationLink(notification, role) {
  const home = ROLE_HOME[role] ?? '/';
  const type = notification?.type ?? '';

  if (type.startsWith('meeting_')) {
    const meetingId = id(notification, 'meetingId');
    if (role === ROLES.TEACHER && meetingId && !notification.data?.removed) {
      return teacherPaths.meeting(meetingId);
    }
    return `${home}/meetings`;
  }
  if (type === 'notice') return `${home}/notices`;
  if (type.startsWith('result_')) return `${home}/results`;
  if (['absence', 'attendance_corrected', 'low_attendance'].includes(type)) {
    return `${home}/attendance`;
  }
  return home;
}

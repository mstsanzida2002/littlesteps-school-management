import { api } from '../../../lib/axios.js';

export const schoolKeys = {
  all: ['school'],
  settings: ['school', 'settings'],
  myAssignments: ['school', 'my-assignments'],
};

export const schoolApi = {
  /** { weeklyOffDays, attendanceBackdateDays, attendanceThreshold, lateCountsAsPresent,
   *    gradingScale, today, session } — for every signed-in role. */
  settings: () => api.get('/settings/school').then((res) => res.data),
  /** Teachers: { session, classSections: [{ classId, sectionId, label, subjects }], wholeClasses } */
  myAssignments: () => api.get('/teacher-assignments/mine').then((res) => res.data),
};

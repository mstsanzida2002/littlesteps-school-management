import { api } from '../../../lib/axios.js';

export const attendanceKeys = {
  all: ['attendance'],
  today: ['attendance', 'today'],
  sheet: (classId, sectionId, date) => ['attendance', 'sheet', classId, sectionId, date],
  classSummary: (classId, sectionId, params) => [
    'attendance',
    'class-summary',
    classId,
    sectionId,
    params,
  ],
  studentSummary: (studentId, params) => ['attendance', 'student', studentId, 'summary', params],
  studentHistory: (studentId, params) => ['attendance', 'student', studentId, 'history', params],
};

const classSection = ({ classId, sectionId }) =>
  `/attendance/class-sections/${classId}/${sectionId}`;

export const attendanceApi = {
  today: () => api.get('/attendance/today').then((res) => res.data),
  /** Students, the teacher's subjects for that day ({ subjects, availableSubjects? }) and records. */
  sheet: ({ classId, sectionId, date }) =>
    api
      .get(`${classSection({ classId, sectionId })}/sheet`, { params: { date } })
      .then((res) => res.data),
  /** { classId, sectionId, date, defaultStatus, entries, subjectIds? } → envelope (message, data) */
  mark: (body) => api.post('/attendance', body),
  editRecord: ({ id, status, reason }) => api.patch(`/attendance/${id}`, { status, reason }),
  editDay: ({ studentId, date, ...body }) =>
    api.patch(`/attendance/students/${studentId}/days/${date}`, body),
  classSummary: ({ classId, sectionId, ...params }) =>
    api.get(`${classSection({ classId, sectionId })}/summary`, { params }).then((res) => res.data),
  studentSummary: (studentId, params) =>
    api.get(`/attendance/student/${studentId}/summary`, { params }).then((res) => res.data),
  studentHistory: (studentId, params) =>
    api.get(`/attendance/student/${studentId}/history`, { params }).then((res) => res.data),
};

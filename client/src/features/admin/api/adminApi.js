import { api } from '../../../lib/axios.js';

/**
 * Admin resources (FR-ADM-01…11). Query keys start with the roots that "data:changed" scopes
 * invalidate (lib/dataChangedInvalidation.js): users, structure, assignments, settings, audit.
 */
export const adminKeys = {
  users: ['users'],
  userList: (params) => ['users', 'list', params],
  user: (id) => ['users', 'detail', id],
  nextRoll: (params) => ['users', 'next-roll', params],
  structure: ['structure'],
  classes: ['structure', 'classes'],
  sections: (classId) => ['structure', 'sections', classId ?? 'all'],
  subjects: ['structure', 'subjects'],
  sessions: ['structure', 'sessions'],
  assignments: ['assignments'],
  assignmentList: (params) => ['assignments', 'list', params],
  settings: ['settings'],
  audit: (params) => ['audit', params],
};

const envelope = (res) => res; // { data, meta, message }
const data = (res) => res.data;

export const adminApi = {
  // --- Users & registrations -------------------------------------------------------
  /** params: { page, limit, sort, search, role, status, classId, sectionId } → { data, meta } */
  users: (params) => api.get('/users', { params }).then(envelope),
  user: (id) => api.get(`/users/${id}`).then(data),
  /** { classId, sectionId } → { suggestedRollNo, taken } */
  nextRoll: (params) => api.get('/users/next-roll', { params }).then(data),
  createUser: (body) => api.post('/users', body).then(data),
  updateUser: ({ id, ...body }) => api.patch(`/users/${id}`, body).then(data),
  suspendUser: ({ id, reason }) => api.patch(`/users/${id}/suspend`, { reason }).then(data),
  reactivateUser: (id) => api.patch(`/users/${id}/reactivate`).then(data),
  resetPassword: ({ id, newPassword }) =>
    api.patch(`/users/${id}/password`, { newPassword }).then(data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  approve: ({ id, ...body }) => api.patch(`/users/${id}/approve`, body).then(data),
  reject: ({ id, reason }) => api.patch(`/users/${id}/reject`, { reason }).then(data),

  // --- Academic structure ------------------------------------------------------------
  classes: () => api.get('/classes', { params: { limit: 100 } }).then(data),
  createClass: (body) => api.post('/classes', body).then(data),
  updateClass: ({ id, ...body }) => api.patch(`/classes/${id}`, body).then(data),
  deleteClass: (id) => api.delete(`/classes/${id}`),
  sections: (classId) =>
    api.get('/sections', { params: { limit: 100, ...(classId && { classId }) } }).then(data),
  createSection: (body) => api.post('/sections', body).then(data),
  updateSection: ({ id, ...body }) => api.patch(`/sections/${id}`, body).then(data),
  deleteSection: (id) => api.delete(`/sections/${id}`),
  subjects: () => api.get('/subjects', { params: { limit: 100 } }).then(data),
  createSubject: (body) => api.post('/subjects', body).then(data),
  updateSubject: ({ id, ...body }) => api.patch(`/subjects/${id}`, body).then(data),
  deleteSubject: (id) => api.delete(`/subjects/${id}`),
  sessions: () => api.get('/sessions', { params: { limit: 100 } }).then(data),
  createSession: (body) => api.post('/sessions', body).then(data),
  updateSession: ({ id, ...body }) => api.patch(`/sessions/${id}`, body).then(data),
  deleteSession: (id) => api.delete(`/sessions/${id}`),
  /** Without confirm, switching answers 409 SESSION_SWITCH_CONFIRMATION_REQUIRED with counts. */
  activateSession: ({ id, confirm }) =>
    api.post(`/sessions/${id}/activate`, confirm ? { confirm: true } : {}),

  // --- Teacher assignments -------------------------------------------------------------
  assignments: (params) =>
    api.get('/teacher-assignments', { params: { limit: 100, ...params } }).then(envelope),
  createAssignment: (body) => api.post('/teacher-assignments', body).then(data),
  updateSchedule: ({ id, schedule }) =>
    api.patch(`/teacher-assignments/${id}`, { schedule }).then(data),
  /** → envelope; data.ended says whether it was ended (history kept) or deleted. */
  removeAssignment: (id) => api.delete(`/teacher-assignments/${id}`),

  // --- Settings & audit ------------------------------------------------------------------
  settings: () => api.get('/settings').then(data),
  updateSettings: (changes) => api.patch('/settings', changes).then(data),
  /** params: { page, limit, action, actorId, entityType, entityId, from, to } → { data, meta } */
  audit: (params) => api.get('/audit-logs', { params }).then(envelope),
};

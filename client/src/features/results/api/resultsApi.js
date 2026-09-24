import { api } from '../../../lib/axios.js';

export const resultsKeys = {
  all: ['results'],
  list: (params) => ['results', 'list', params],
  detail: (id) => ['results', 'detail', id],
};

export const resultsApi = {
  /** → envelope { data: assessments (with `entries` count), meta } */
  list: (params) => api.get('/assessments', { params }),
  /** Assessment with students[] ({ studentId, name, rollNo, result }) */
  get: (id) => api.get(`/assessments/${id}`).then((res) => res.data),
  create: (body) => api.post('/assessments', body).then((res) => res.data),
  update: ({ id, ...changes }) => api.patch(`/assessments/${id}`, changes).then((res) => res.data),
  remove: (id) => api.delete(`/assessments/${id}`),
  /** Draft entries: [{ studentId, attendance, marksObtained?, grade?, remarks? }] */
  saveDraft: ({ id, entries }) => api.put(`/results/${id}`, { entries }),
  publish: (id) => api.patch(`/assessments/${id}/publish`),
  /** A published result: changes + reason */
  editResult: ({ resultId, ...body }) => api.patch(`/results/${resultId}`, body),
};

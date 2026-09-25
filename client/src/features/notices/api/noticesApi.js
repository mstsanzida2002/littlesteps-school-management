import { api } from '../../../lib/axios.js';

export const noticesKeys = {
  all: ['notices'],
  list: (params) => ['notices', 'list', params],
  detail: (id) => ['notices', 'detail', id],
};

export const noticesApi = {
  /** Published, unexpired notices for the caller's role, pinned first → envelope { data, meta }.
   *  Admins see every notice; params: { status, audience, includeExpired, page, limit }. */
  list: (params) => api.get('/notices', { params }),
  get: (id) => api.get(`/notices/${id}`).then((res) => res.data),
  // Admin only (FR-ADM-08).
  create: (body) => api.post('/notices', body),
  update: ({ id, ...body }) => api.patch(`/notices/${id}`, body),
  publish: (id) => api.post(`/notices/${id}/publish`),
  expire: (id) => api.patch(`/notices/${id}/expire`),
  remove: (id) => api.delete(`/notices/${id}`),
};

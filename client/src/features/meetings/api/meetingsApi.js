import { api } from '../../../lib/axios.js';

export const meetingsKeys = {
  all: ['meetings'],
  list: (params) => ['meetings', 'list', params],
  detail: (id) => ['meetings', 'detail', id],
  responses: (id) => ['meetings', 'responses', id],
};

export const meetingsApi = {
  /** → envelope { data, meta }; params: { when: 'upcoming' | 'past', status, page, limit } */
  list: (params) => api.get('/meetings', { params }),
  get: (id) => api.get(`/meetings/${id}`).then((res) => res.data),
  /** { counts: { will_attend, cannot_attend, no_response }, students: [...] } */
  responses: (id) => api.get(`/meetings/${id}/responses`).then((res) => res.data),
  create: (body) => api.post('/meetings', body).then((res) => res.data),
  update: ({ id, ...changes }) => api.patch(`/meetings/${id}`, changes).then((res) => res.data),
  cancel: ({ id, reason }) => api.post(`/meetings/${id}/cancel`, { reason }),
  /** Guardians: { response: 'will_attend' | 'cannot_attend', note? } → the meeting */
  respond: ({ id, response, note }) =>
    api.patch(`/meetings/${id}/respond`, { response, note }).then((res) => res.data),
};

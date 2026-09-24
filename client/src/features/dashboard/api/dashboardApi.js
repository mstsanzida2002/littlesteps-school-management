import { api } from '../../../lib/axios.js';

export const dashboardKeys = {
  all: ['dashboard'],
  role: (role) => ['dashboard', role],
};

/** One request per role (GET /api/dashboard/{admin|teacher|student}). */
export const dashboardApi = {
  get: (role) => api.get(`/dashboard/${role}`).then((res) => res.data),
};

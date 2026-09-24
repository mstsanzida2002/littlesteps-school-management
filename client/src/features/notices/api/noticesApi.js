import { api } from '../../../lib/axios.js';

export const noticesKeys = {
  all: ['notices'],
  list: (params) => ['notices', 'list', params],
};

export const noticesApi = {
  /** Published, unexpired notices for the caller's role, pinned first → envelope { data, meta } */
  list: (params) => api.get('/notices', { params }),
};

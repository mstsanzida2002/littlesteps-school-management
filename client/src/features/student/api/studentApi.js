import { api } from '../../../lib/axios.js';

export const studentKeys = {
  all: ['student'],
  profile: ['student', 'profile'],
};

export const studentApi = {
  /** The signed-in child's profile: { student, session, guardian, teachers: [{ subject, teachers }] } */
  profile: () => api.get('/students/me').then((res) => res.data),
};

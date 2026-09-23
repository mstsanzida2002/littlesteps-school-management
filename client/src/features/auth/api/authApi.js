import { api } from '../../../lib/axios.js';

// Raw auth endpoints. Components use features/auth/session.js (via useAuth/useLogin), which
// keeps tokenStore, the query cache and the auth state consistent.
export const authApi = {
  /** → { accessToken, user } and sets the refresh cookie */
  login: (credentials) => api.post('/auth/login', credentials).then((res) => res.data),
  /** → { accessToken, user }; rotates the refresh cookie */
  refresh: () => api.post('/auth/refresh').then((res) => res.data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me').then((res) => res.data.user),
  /** → { accessToken, user }: other devices are signed out, this one gets a new session */
  changePassword: (body) => api.patch('/auth/password', body).then((res) => res.data),
  register: (body) => api.post('/auth/register', body).then((res) => res.data),
};

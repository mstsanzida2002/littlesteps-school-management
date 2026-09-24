import { api } from '../../../lib/axios.js';

export const notificationKeys = {
  all: ['notifications'],
  unreadCount: ['notifications', 'unread-count'],
  list: (params) => ['notifications', 'list', params],
};

export const notificationsApi = {
  unreadCount: () => api.get('/notifications/unread-count').then((res) => res.data.count),
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then((res) => res.data),
  markAllRead: () => api.patch('/notifications/read-all').then((res) => res.data),
};

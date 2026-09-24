import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationKeys, notificationsApi } from '../api/notificationsApi.js';

/** The signed-in user's notifications (FR-NOT-03/04); params: { page, limit, unread }. */
export function useNotifications(params) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

function useNotificationMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Dashboards list unread notifications too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]),
  });
}

export const useMarkNotificationRead = () => useNotificationMutation(notificationsApi.markRead);
export const useMarkAllNotificationsRead = () =>
  useNotificationMutation(notificationsApi.markAllRead);

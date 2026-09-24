import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { socket, socketStatus } from '../../../lib/socket.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import { notificationKeys, notificationsApi } from '../api/notificationsApi.js';

const POLL_WHEN_OFFLINE_MS = 60_000;

/**
 * Unread notification count (FR-NOT-03). Pushed over Socket.io when connected; polled every
 * 60 s when the socket is down, so the bell works either way.
 */
export function useUnreadCount() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const socketConnected = useSyncExternalStore(socketStatus.subscribe, socketStatus.getSnapshot);

  useEffect(() => {
    const onCount = ({ count }) => queryClient.setQueryData(notificationKeys.unreadCount, count);
    const onChange = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    socket.on('notifications:unread-count', onCount);
    socket.on('notification:new', onChange);
    socket.on('notification:updated', onChange);
    return () => {
      socket.off('notifications:unread-count', onCount);
      socket.off('notification:new', onChange);
      socket.off('notification:updated', onChange);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: notificationsApi.unreadCount,
    enabled: isAuthenticated,
    refetchInterval: socketConnected ? false : POLL_WHEN_OFFLINE_MS,
    // Refetch on reconnect to catch anything missed while offline.
    refetchOnReconnect: true,
  });
}

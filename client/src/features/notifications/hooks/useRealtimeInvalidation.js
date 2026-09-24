import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { keysForNotification } from '../../../lib/realtimeInvalidation.js';
import { socket } from '../../../lib/socket.js';

/**
 * Keeps screens live: when a notification arrives over Socket.io, refresh the data it is about
 * (attendance, results, meetings, notices) and the dashboards. The bell's own count and the
 * notification list are handled by useUnreadCount. Mounted once, in the dashboard shell.
 */
export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onNotification = (notification) => {
      for (const queryKey of keysForNotification(notification)) {
        queryClient.invalidateQueries({ queryKey });
      }
    };
    socket.on('notification:new', onNotification);
    socket.on('notification:updated', onNotification);
    return () => {
      socket.off('notification:new', onNotification);
      socket.off('notification:updated', onNotification);
    };
  }, [queryClient]);
}

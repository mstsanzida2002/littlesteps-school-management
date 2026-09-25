import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { keysForDataChange, keysForNotification } from '../../../lib/realtimeInvalidation.js';
import { socket } from '../../../lib/socket.js';

// "data:changed" can come in small bursts (several class-sections at once): refetch once.
const BATCH_MS = 250;

/**
 * Keeps screens live. A pushed notification refreshes the data it is about (attendance, results,
 * meetings, notices) and the dashboards; a "data:changed" signal (admins, co-teachers) refreshes
 * its scope without a notification. The bell's own count and the notification list are handled
 * by useUnreadCount. Mounted once, in the dashboard shell.
 */
export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let pending = new Map();
    let timer = null;
    const flush = () => {
      const keys = [...pending.values()];
      pending = new Map();
      timer = null;
      for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
    };
    const invalidate = (keys) => {
      for (const key of keys) pending.set(JSON.stringify(key), key);
      timer ??= setTimeout(flush, BATCH_MS);
    };

    const onNotification = (notification) => invalidate(keysForNotification(notification));
    const onDataChanged = (change) => invalidate(keysForDataChange(change));
    socket.on('notification:new', onNotification);
    socket.on('notification:updated', onNotification);
    socket.on('data:changed', onDataChanged);
    return () => {
      clearTimeout(timer);
      socket.off('notification:new', onNotification);
      socket.off('notification:updated', onNotification);
      socket.off('data:changed', onDataChanged);
    };
  }, [queryClient]);
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { dashboardApi, dashboardKeys } from '../api/dashboardApi.js';

/**
 * The role's dashboard. Refreshed by mutations, by pushed notifications
 * (useRealtimeInvalidation) and when the user comes back to the tab.
 */
export function useDashboard(role) {
  return useQuery({
    queryKey: dashboardKeys.role(role),
    queryFn: () => dashboardApi.get(role),
    refetchOnWindowFocus: true,
  });
}

/**
 * Start the dashboard request as soon as the shell mounts on the role's home page, in parallel
 * with the page's code download (the page's own useDashboard then finds it in flight).
 */
export function usePrefetchDashboard(role, enabled) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (enabled) {
      queryClient.prefetchQuery({
        queryKey: dashboardKeys.role(role),
        queryFn: () => dashboardApi.get(role),
      });
    }
  }, [queryClient, role, enabled]);
}

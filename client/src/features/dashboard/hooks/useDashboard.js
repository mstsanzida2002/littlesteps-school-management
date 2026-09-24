import { useQuery } from '@tanstack/react-query';

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

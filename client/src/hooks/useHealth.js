import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/axios.js';

export const healthKeys = {
  all: ['health'],
};

export const fetchHealth = () => api.get('/health').then((res) => res.data);

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });
}

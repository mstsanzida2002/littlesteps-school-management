import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { noticesApi, noticesKeys } from '../api/noticesApi.js';

export function useNotices(params) {
  return useQuery({
    queryKey: noticesKeys.list(params),
    queryFn: () => noticesApi.list(params),
    placeholderData: keepPreviousData,
  });
}

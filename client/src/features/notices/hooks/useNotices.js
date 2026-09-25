import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { noticesApi, noticesKeys } from '../api/noticesApi.js';

export function useNotices(params) {
  return useQuery({
    queryKey: noticesKeys.list(params),
    queryFn: () => noticesApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useNotice(id) {
  return useQuery({
    queryKey: noticesKeys.detail(id),
    queryFn: () => noticesApi.get(id),
    enabled: Boolean(id),
  });
}

const mutationHook = (mutationFn) =>
  function useNoticeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn,
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: noticesKeys.all }),
          queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        ]),
    });
  };

export const useCreateNotice = mutationHook(noticesApi.create);
export const useUpdateNotice = mutationHook(noticesApi.update);
export const usePublishNotice = mutationHook(noticesApi.publish);
export const useExpireNotice = mutationHook(noticesApi.expire);
export const useDeleteNotice = mutationHook(noticesApi.remove);

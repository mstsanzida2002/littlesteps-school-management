import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { meetingsApi, meetingsKeys } from '../api/meetingsApi.js';

function useInvalidateMeetings() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: meetingsKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useMeetings(params) {
  return useQuery({
    queryKey: meetingsKeys.list(params),
    queryFn: () => meetingsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useMeeting(id) {
  return useQuery({
    queryKey: meetingsKeys.detail(id),
    queryFn: () => meetingsApi.get(id),
    enabled: Boolean(id),
  });
}

export function useMeetingResponses(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: meetingsKeys.responses(id),
    queryFn: () => meetingsApi.responses(id),
    enabled: Boolean(id) && enabled,
  });
}

const mutationHook = (mutationFn) =>
  function useMeetingMutation() {
    const invalidate = useInvalidateMeetings();
    return useMutation({ mutationFn, onSuccess: invalidate });
  };

export const useCreateMeeting = mutationHook(meetingsApi.create);
export const useUpdateMeeting = mutationHook(meetingsApi.update);
export const useCancelMeeting = mutationHook(meetingsApi.cancel);

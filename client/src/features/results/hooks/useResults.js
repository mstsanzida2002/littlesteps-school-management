import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { resultsApi, resultsKeys } from '../api/resultsApi.js';

function useInvalidateResults() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: resultsKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useAssessments(params) {
  return useQuery({
    queryKey: resultsKeys.list(params),
    queryFn: () => resultsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useAssessment(id) {
  return useQuery({
    queryKey: resultsKeys.detail(id),
    queryFn: () => resultsApi.get(id),
    enabled: Boolean(id),
  });
}

const mutationHook = (mutationFn) =>
  function useResultsMutation() {
    const invalidate = useInvalidateResults();
    return useMutation({ mutationFn, onSuccess: invalidate });
  };

export const useCreateAssessment = mutationHook(resultsApi.create);
export const useUpdateAssessment = mutationHook(resultsApi.update);
export const useDeleteAssessment = mutationHook(resultsApi.remove);
export const useSaveDraftResults = mutationHook(resultsApi.saveDraft);
export const usePublishAssessment = mutationHook(resultsApi.publish);
export const useEditPublishedResult = mutationHook(resultsApi.editResult);

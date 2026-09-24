import { ErrorState } from './ErrorState.jsx';

/**
 * Loading → skeleton, error → ErrorState with "Try again", otherwise render the data.
 *
 *   <QueryState query={dashboard} loading={<DashboardSkeleton />}>
 *     {(data) => <Dashboard data={data} />}
 *   </QueryState>
 */
export function QueryState({ query, loading, errorTitle, compact = false, children }) {
  if (query.isPending) return loading ?? null;
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title={errorTitle}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
        compact={compact}
      />
    );
  }
  return children(query.data);
}

import { PageHeader } from '../components/ui/PageHeader.jsx';
import { APP_NAME } from '../config/constants.js';
import { useHealth } from '../hooks/useHealth.js';
import { formatDateTime } from '../utils/date.js';

export default function HomePage() {
  const { data, isPending, isError, error } = useHealth();

  return (
    <>
      <PageHeader
        title={`Welcome to ${APP_NAME}`}
        description="Attendance, results, meetings and notices for our nursery school."
      />

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold">System status</h2>
        {isPending && <p className="text-muted">Checking API…</p>}
        {isError && (
          <p className="font-semibold text-absent-ink">API unreachable: {error.message}</p>
        )}
        {data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-muted">API</dt>
            <dd className="font-semibold text-present-ink">{data.status}</dd>
            <dt className="text-muted">Database</dt>
            <dd
              className={`font-semibold ${data.database === 'connected' ? 'text-present-ink' : 'text-late-ink'}`}
            >
              {data.database}
            </dd>
            <dt className="text-muted">Environment</dt>
            <dd>{data.environment}</dd>
            <dt className="text-muted">Checked</dt>
            <dd>{formatDateTime(data.timestamp)}</dd>
          </dl>
        )}
      </section>
    </>
  );
}

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

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-bold">System status</h2>
        {isPending && <p className="text-slate-500">Checking API…</p>}
        {isError && <p className="font-semibold text-absent">API unreachable: {error.message}</p>}
        {data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-slate-500">API</dt>
            <dd className="font-semibold text-present">{data.status}</dd>
            <dt className="text-slate-500">Database</dt>
            <dd
              className={`font-semibold ${data.database === 'connected' ? 'text-present' : 'text-late'}`}
            >
              {data.database}
            </dd>
            <dt className="text-slate-500">Environment</dt>
            <dd>{data.environment}</dd>
            <dt className="text-slate-500">Checked</dt>
            <dd>{formatDateTime(data.timestamp)}</dd>
          </dl>
        )}
      </section>
    </>
  );
}

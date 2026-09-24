import { Megaphone, Pin } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { Badge } from '../../../components/ui/Badge.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { formatSchoolDate } from '../../../utils/date.js';
import { useNotices } from '../hooks/useNotices.js';

const AUDIENCE = { all: 'Everyone', teachers: 'Teachers', students: 'Guardians' };
const BANGLA = /[ঀ-৿]/;

/** Read-only notices for the signed-in role (FR-STU-08), pinned first. Same for every role. */
export default function NoticesPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1);
  const notices = useNotices({ page, limit: 10 });

  return (
    <>
      <PageHeader title="Notices" description="News and reminders from the school." />
      {notices.isError ? (
        <Card>
          <ErrorState
            error={notices.error}
            onRetry={() => notices.refetch()}
            retrying={notices.isFetching}
          />
        </Card>
      ) : notices.isPending ? (
        <div aria-busy="true" aria-label="Loading notices" className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : notices.data.data.length ? (
        <>
          <ul className="flex flex-col gap-3">
            {notices.data.data.map((n) => (
              <li key={n._id}>
                <Card as="article" className={n.isPinned ? 'border-cerise-200' : undefined}>
                  <header className="flex flex-wrap items-start gap-2">
                    <h2
                      lang={BANGLA.test(n.title) ? 'bn' : undefined}
                      className="min-w-0 flex-1 text-lg font-bold"
                    >
                      {n.title}
                    </h2>
                    {n.isPinned && (
                      <Badge tone="absent" icon={Pin} size="sm">
                        Pinned
                      </Badge>
                    )}
                  </header>
                  <p className="text-sm text-muted">
                    {formatSchoolDate(n.publishedAt ?? n.createdAt, { weekday: true })} · For{' '}
                    {AUDIENCE[n.audience]?.toLowerCase() ?? n.audience}
                  </p>
                  <p
                    lang={BANGLA.test(n.body) ? 'bn' : undefined}
                    className="mt-3 whitespace-pre-line"
                  >
                    {n.body}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination
            meta={notices.data.meta}
            onPageChange={(p) => setParams({ page: String(p) })}
          />
        </>
      ) : (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No notices right now"
            description="New notices from the school will show here."
          />
        </Card>
      )}
    </>
  );
}

import { Megaphone, Pin } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { Badge } from '../../../components/ui/Badge.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { ROLES } from '../../../config/constants.js';
import { cn } from '../../../utils/cn.js';
import { formatSchoolDate } from '../../../utils/date.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import { useNotices } from '../hooks/useNotices.js';
import { text } from '../text/index.js';

const BANGLA = /[ঀ-৿]/;

/**
 * Read-only notices for the signed-in role (FR-STU-08), pinned first. Guardians get warmer
 * words and a pinned notice stands out with a coloured edge.
 */
export default function NoticesPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const guardian = user?.role === ROLES.STUDENT;
  const page = Number(params.get('page') ?? 1);
  const notices = useNotices({ page, limit: 10 });

  return (
    <>
      <PageHeader
        title={text.title}
        description={guardian ? text.guardianDescription : text.description}
      />
      {notices.isError ? (
        <Card>
          <ErrorState
            error={notices.error}
            onRetry={() => notices.refetch()}
            retrying={notices.isFetching}
          />
        </Card>
      ) : notices.isPending ? (
        <div aria-busy="true" aria-label={text.loading} className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : notices.data.data.length ? (
        <>
          <ul className="flex flex-col gap-3">
            {notices.data.data.map((n) => (
              <li key={n._id}>
                <Card
                  as="article"
                  className={cn(
                    n.isPinned && 'border-cerise-200',
                    guardian && n.isPinned && 'border-l-4 border-l-cerise-400',
                  )}
                >
                  <header className="flex flex-wrap items-start gap-2">
                    <h2
                      lang={BANGLA.test(n.title) ? 'bn' : undefined}
                      className="min-w-0 flex-1 text-lg font-bold"
                    >
                      {n.title}
                    </h2>
                    {n.isPinned && (
                      <Badge tone="absent" icon={Pin} size="sm">
                        {text.pinned}
                      </Badge>
                    )}
                  </header>
                  <p className="text-sm text-muted">
                    {text.meta(
                      formatSchoolDate(n.publishedAt ?? n.createdAt, { weekday: true }),
                      text.audience[n.audience] ?? n.audience,
                    )}
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
          <EmptyState icon={Megaphone} title={text.empty} description={text.emptyHint} />
        </Card>
      )}
    </>
  );
}

import { Megaphone } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { ROLES } from '../../../config/constants.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import { NoticeCard } from '../components/NoticeCard.jsx';
import { useNotices } from '../hooks/useNotices.js';
import { text } from '../text/index.js';

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
                <NoticeCard notice={n} guardian={guardian} />
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

import { Pin } from 'lucide-react';

import { Badge } from '../../../components/ui/Badge.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { cn } from '../../../utils/cn.js';
import { formatSchoolDate, todayDateKey } from '../../../utils/date.js';
import { text } from '../text/index.js';

const BANGLA = /[ঀ-৿]/;

/**
 * One notice as readers see it (the notices page, and the admin's "how guardians will see it"
 * preview). `guardian` gives pinned notices a coloured edge.
 */
export function NoticeCard({ notice: n, guardian = false, as = 'article' }) {
  return (
    <Card
      as={as}
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
          formatSchoolDate(n.publishedAt ?? n.createdAt ?? todayDateKey(), { weekday: true }),
          text.audience[n.audience] ?? n.audience,
        )}
      </p>
      <p lang={BANGLA.test(n.body) ? 'bn' : undefined} className="mt-3 whitespace-pre-line">
        {n.body}
      </p>
    </Card>
  );
}

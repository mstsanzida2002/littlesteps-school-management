import {
  Archive,
  CalendarX,
  FileText,
  Megaphone,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Badge, StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { toast } from '../../../components/ui/toast.js';
import { adminPaths } from '../../../config/paths.js';
import { friendlyError } from '../../../lib/errorMessages.js';
import { formatDateTime, formatSchoolDate } from '../../../utils/date.js';
import {
  useDeleteNotice,
  useExpireNotice,
  useNotices,
  usePublishNotice,
  useUpdateNotice,
} from '../../notices/hooks/useNotices.js';
import { text as noticeText } from '../../notices/text/index.js';

const TABS = [
  { value: 'all', label: 'Live and drafts', icon: Megaphone },
  { value: 'draft', label: 'Drafts', icon: FileText },
  { value: 'published', label: 'Published', icon: Send },
  { value: 'expired', label: 'Expired', icon: Archive },
];

function NoticeRow({ notice: n, onAction }) {
  const expired = n.isExpired;
  const draft = n.status === 'draft';
  return (
    <Card as="article" aria-label={n.title}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{n.title}</span>
            <StatusBadge group="publication" value={n.status} size="sm" />
            {n.isPinned && (
              <Badge tone="absent" icon={Pin} size="sm">
                Pinned
              </Badge>
            )}
            {expired && (
              <Badge tone="neutral" icon={CalendarX} size="sm">
                Expired
              </Badge>
            )}
          </p>
          <p className="text-sm text-muted">
            For {noticeText.audience[n.audience]} ·{' '}
            {draft
              ? `draft saved ${formatDateTime(n.updatedAt)}`
              : `published ${formatDateTime(n.publishedAt)}${n.publishedBy ? ` by ${n.publishedBy.name}` : ''}`}
            {n.expiresAt && !expired && ` · expires ${formatSchoolDate(n.expiresAt)}`}
          </p>
          <p className="mt-2 line-clamp-2 text-ink">{n.body}</p>
        </div>
        <div className="flex flex-wrap gap-2 md:max-w-80 md:justify-end">
          <Link
            to={adminPaths.editNotice(n._id)}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          >
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </Link>
          {draft && (
            <Button size="sm" icon={Send} onClick={() => onAction('publish', n)}>
              Publish
            </Button>
          )}
          {!expired && (
            <Button
              variant="ghost"
              size="sm"
              icon={n.isPinned ? PinOff : Pin}
              onClick={() => onAction('pin', n)}
            >
              {n.isPinned ? 'Unpin' : 'Pin'}
            </Button>
          )}
          {!draft && !expired && (
            <Button variant="ghost" size="sm" icon={Archive} onClick={() => onAction('expire', n)}>
              Expire
            </Button>
          )}
          <Button
            variant="danger-ghost"
            size="sm"
            icon={Trash2}
            onClick={() => onAction('delete', n)}
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Notices (FR-ADM-08): drafts, publishing, pinning, expiry. */
export default function AdminNoticesPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'all';
  const page = Number(params.get('page') ?? 1);
  const list = useNotices({
    page,
    limit: 10,
    ...(tab === 'draft' && { status: 'draft' }),
    ...(tab === 'published' && { status: 'published' }),
    ...(tab === 'expired' && { includeExpired: 'true' }),
  });
  const publish = usePublishNotice();
  const update = useUpdateNotice();
  const expire = useExpireNotice();
  const remove = useDeleteNotice();
  const [confirming, setConfirming] = useState(null); // { kind, notice }

  const run = async (promise, message) => {
    try {
      const res = await promise;
      toast.success(res?.message ?? message);
      setConfirming(null);
    } catch (err) {
      toast.error(friendlyError(err).message);
    }
  };
  const onAction = (kind, notice) => {
    if (kind === 'pin') {
      run(
        update.mutateAsync({ id: notice._id, isPinned: !notice.isPinned }),
        notice.isPinned ? 'Unpinned' : 'Pinned to the top',
      );
    } else {
      setConfirming({ kind, notice });
    }
  };
  const c = confirming;
  const rows = (data) => (tab === 'expired' ? data.filter((n) => n.isExpired) : data);

  return (
    <>
      <PageHeader
        title="Notices"
        description="News for guardians and staff. Publishing notifies everyone in the audience."
        actions={
          <Link to={adminPaths.newNotice()} className={buttonClasses()}>
            <Plus aria-hidden="true" className="size-5" />
            New notice
          </Link>
        }
      />
      <Tabs
        label="Notices"
        value={tab}
        onChange={(v) => setParams(v === 'all' ? {} : { tab: v }, { replace: true })}
        items={TABS}
      >
        <TabPanel value={tab} className="mt-4 flex flex-col gap-3">
          <QueryState
            query={list}
            loading={
              <div aria-busy="true" aria-label="Loading notices" className="flex flex-col gap-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            }
          >
            {({ data, meta }) =>
              rows(data).length ? (
                <>
                  {rows(data).map((n) => (
                    <NoticeRow key={n._id} notice={n} onAction={onAction} />
                  ))}
                  <Pagination
                    meta={meta}
                    onPageChange={(p) =>
                      setParams({ ...(tab !== 'all' && { tab }), page: String(p) })
                    }
                  />
                </>
              ) : (
                <Card>
                  <EmptyState icon={Megaphone} title="No notices here" />
                </Card>
              )
            }
          </QueryState>
        </TabPanel>
      </Tabs>

      <ConfirmDialog
        open={c?.kind === 'publish'}
        onClose={() => setConfirming(null)}
        tone="primary"
        title={`Publish "${c?.notice.title}"?`}
        message={`Everyone in the audience (${noticeText.audience[c?.notice.audience] ?? ''}) gets a notification. Later edits don't notify again.`}
        confirmLabel="Publish"
        loading={publish.isPending}
        onConfirm={() => run(publish.mutateAsync(c.notice._id), 'Published')}
      />
      <ConfirmDialog
        open={c?.kind === 'expire'}
        onClose={() => setConfirming(null)}
        tone="primary"
        title={`Expire "${c?.notice.title}"?`}
        message="Readers stop seeing it. It stays here under Expired."
        confirmLabel="Expire now"
        loading={expire.isPending}
        onConfirm={() => run(expire.mutateAsync(c.notice._id), 'Expired')}
      />
      <ConfirmDialog
        open={c?.kind === 'delete'}
        onClose={() => setConfirming(null)}
        title={`Delete "${c?.notice.title}"?`}
        message="It disappears for everyone. This can't be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => run(remove.mutateAsync(c.notice._id), 'Deleted')}
      />
    </>
  );
}

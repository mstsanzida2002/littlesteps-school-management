import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

import { Button } from '../../../components/ui/Button.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { toast } from '../../../components/ui/toast.js';
import { notificationLink } from '../../../config/paths.js';
import { errorMessage } from '../../../lib/errorMessages.js';
import { cn } from '../../../utils/cn.js';
import { formatDateTime } from '../../../utils/date.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../hooks/useNotifications.js';
import { NOTIFICATION_ICONS as ICONS } from '../icons.js';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
];

/** Every role's notifications (FR-NOT-03/04). Opening one marks it read and goes to its screen. */
export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const filter = params.get('filter') === 'unread' ? 'unread' : 'all';
  const page = Number(params.get('page') ?? 1);
  const list = useNotifications({
    page,
    limit: 20,
    ...(filter === 'unread' && { unread: 'true' }),
  });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = list.data?.data ?? [];

  const open = async (notification) => {
    if (!notification.isRead) {
      try {
        await markRead.mutateAsync(notification._id);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    }
    navigate(notificationLink(notification, user?.role));
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button
            variant="secondary"
            icon={CheckCheck}
            loading={markAll.isPending}
            onClick={() =>
              markAll.mutate(undefined, {
                onSuccess: () => toast.success('All notifications marked as read'),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            Mark all as read
          </Button>
        }
      />
      <Tabs
        label="Notifications"
        value={filter}
        onChange={(value) => setParams(value === 'all' ? {} : { filter: value }, { replace: true })}
        items={TABS}
      >
        <TabPanel value={filter}>
          {list.isError ? (
            <Card>
              <ErrorState
                error={list.error}
                onRetry={() => list.refetch()}
                retrying={list.isFetching}
              />
            </Card>
          ) : list.isPending ? (
            <div
              aria-busy="true"
              aria-label="Loading notifications"
              className="flex flex-col gap-2"
            >
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-card" />
              ))}
            </div>
          ) : items.length ? (
            <>
              <Card padded={false}>
                <ul className="divide-y divide-line">
                  {items.map((n) => {
                    const { icon: Icon, className } = ICONS[n.type] ?? {
                      icon: Bell,
                      className: 'bg-sand-100 text-sand-700',
                    };
                    return (
                      <li key={n._id}>
                        <button
                          type="button"
                          onClick={() => open(n)}
                          className={cn(
                            'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-blush-50',
                            !n.isRead && 'bg-brand-50/60',
                          )}
                        >
                          <span
                            className={cn(
                              'grid size-10 shrink-0 place-items-center rounded-full',
                              className,
                            )}
                          >
                            <Icon aria-hidden="true" className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block', n.isRead ? 'font-medium' : 'font-bold')}>
                              {!n.isRead && <span className="sr-only">Unread: </span>}
                              {n.title}
                            </span>
                            <span className="block text-sm text-muted">{n.message}</span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {formatDateTime(n.updatedAt ?? n.createdAt)}
                            </span>
                          </span>
                          {!n.isRead && (
                            <span
                              aria-hidden="true"
                              className="mt-2 size-2.5 shrink-0 rounded-full bg-cerise-500"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
              <Pagination
                meta={list.data.meta}
                onPageChange={(p) =>
                  setParams({ ...(filter === 'unread' && { filter }), page: String(p) })
                }
                className="mt-4"
              />
            </>
          ) : (
            <Card>
              <EmptyState
                icon={Bell}
                title={filter === 'unread' ? 'All caught up' : 'No notifications yet'}
                description={
                  filter === 'unread'
                    ? 'You have read everything.'
                    : 'Updates from the school will appear here.'
                }
              />
            </Card>
          )}
        </TabPanel>
      </Tabs>
    </>
  );
}

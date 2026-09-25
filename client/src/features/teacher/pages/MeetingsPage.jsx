import { CalendarCheck, CalendarClock, MapPin, Plus, UsersRound, Video } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { formatDateTime } from '../../../utils/date.js';
import { plural } from '../../../utils/format.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import { useMeetings } from '../../meetings/hooks/useMeetings.js';
import { useRolePaths } from '../../school/hooks/useScope.js';
import { meetingState, meetingTypeLabel } from '../../meetings/labels.js';

const TABS = [
  { value: 'upcoming', label: 'Upcoming', icon: CalendarClock },
  { value: 'past', label: 'Past', icon: CalendarCheck },
];

function MeetingCard({ meeting, userId }) {
  const paths = useRolePaths();
  const Where = meeting.onlineLink ? Video : MapPin;
  const mine = String(meeting.organizerId?._id) === String(userId);
  const invitees = meeting.inviteeStudentIds?.length;
  const replies = meeting.responses?.length;
  return (
    <li>
      <Link
        to={paths.meeting(meeting._id)}
        className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-300 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{meeting.title}</span>
            <StatusBadge group="meeting" value={meetingState(meeting)} size="sm" />
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <Where aria-hidden="true" className="size-4 shrink-0" />
            {formatDateTime(meeting.dateTime, { weekday: true })}
            {meeting.venue ? ` · ${meeting.venue}` : ' · Online'}
          </p>
          <p className="text-sm text-muted">
            {meetingTypeLabel(meeting.type)} ·{' '}
            {mine ? 'You organise' : `Organised by ${meeting.organizerId?.name}`}
          </p>
        </div>
        {invitees != null && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-sand-700">
            <UsersRound aria-hidden="true" className="size-4" />
            {replies} of {plural(invitees, 'guardian')} replied
          </p>
        )}
      </Link>
    </li>
  );
}

export default function MeetingsPage() {
  const paths = useRolePaths();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const when = params.get('when') === 'past' ? 'past' : 'upcoming';
  const page = Number(params.get('page') ?? 1);
  const list = useMeetings({ when, page, limit: 10 });
  const newButton = (
    <Link to={paths.newMeeting()} className={buttonClasses()}>
      <Plus aria-hidden="true" className="size-5" />
      New meeting
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Meetings you organise or are invited to."
        actions={newButton}
      />
      <Tabs
        label="Meetings"
        value={when}
        onChange={(value) =>
          setParams(value === 'upcoming' ? {} : { when: value }, { replace: true })
        }
        items={TABS}
      >
        <TabPanel value={when} className="flex flex-col gap-4">
          {list.isError ? (
            <Card>
              <ErrorState
                error={list.error}
                onRetry={() => list.refetch()}
                retrying={list.isFetching}
              />
            </Card>
          ) : list.isPending ? (
            <div aria-busy="true" aria-label="Loading meetings" className="flex flex-col gap-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : list.data.data.length ? (
            <>
              <ul className="flex flex-col gap-3">
                {list.data.data.map((m) => (
                  <MeetingCard key={m._id} meeting={m} userId={user?.id ?? user?._id} />
                ))}
              </ul>
              <Pagination
                meta={list.data.meta}
                onPageChange={(p) =>
                  setParams({ ...(when === 'past' && { when }), page: String(p) })
                }
              />
            </>
          ) : (
            <Card>
              <EmptyState
                icon={when === 'past' ? CalendarCheck : CalendarClock}
                title={when === 'past' ? 'No past meetings' : 'No upcoming meetings'}
                description="Invite the guardians of your classes to a meeting, in person or online."
                action={when === 'upcoming' && newButton}
              />
            </Card>
          )}
        </TabPanel>
      </Tabs>
    </>
  );
}

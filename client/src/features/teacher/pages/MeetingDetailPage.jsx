import {
  ArrowLeft,
  CalendarX,
  Clock,
  ExternalLink,
  MapPin,
  Pencil,
  UsersRound,
  Video,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { toast } from '../../../components/ui/toast.js';
import { getStatus } from '../../../config/statuses.js';
import { teacherPaths } from '../../../config/paths.js';
import { errorMessage } from '../../../lib/errorMessages.js';
import { cn } from '../../../utils/cn.js';
import { formatDateTime } from '../../../utils/date.js';
import { plural } from '../../../utils/format.js';
import { TONE_SOFT } from '../../../components/ui/tones.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import {
  useCancelMeeting,
  useMeeting,
  useMeetingResponses,
} from '../../meetings/hooks/useMeetings.js';
import { meetingState, meetingTypeLabel } from '../../meetings/labels.js';

function Responses({ meetingId }) {
  const responses = useMeetingResponses(meetingId);
  return (
    <QueryState query={responses} compact loading={<Skeleton className="h-48 rounded-card" />}>
      {(data) => (
        <div className="flex flex-col gap-4">
          <ul className="grid grid-cols-3 gap-2" aria-label="Replies">
            {['will_attend', 'cannot_attend', 'no_response'].map((value) => {
              const meta = getStatus('rsvp', value);
              return (
                <li
                  key={value}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-control p-3 text-center',
                    TONE_SOFT[meta.tone],
                  )}
                >
                  <meta.icon aria-hidden="true" className="size-5" />
                  <span className="text-2xl font-bold tabular-nums">{data.counts[value]}</span>
                  <span className="text-xs font-semibold">{meta.label}</span>
                </li>
              );
            })}
          </ul>
          <DataTable
            caption="Replies by student"
            rowKey="studentId"
            columns={[
              {
                key: 'name',
                header: 'Student',
                mobile: 'title',
                cell: (s) => <span className="font-semibold">{s.name}</span>,
              },
              {
                key: 'classSection',
                header: 'Class',
                mobile: 'subtitle',
                cell: (s) => `${s.classSection} · Roll ${s.rollNo}`,
              },
              {
                key: 'response',
                header: 'Reply',
                cell: (s) => <StatusBadge group="rsvp" value={s.response} size="sm" />,
              },
              { key: 'note', header: 'Note', cell: (s) => s.note || '—' },
            ]}
            rows={data.students}
            empty={<EmptyState compact icon={UsersRound} title="No guardians invited" />}
          />
        </div>
      )}
    </QueryState>
  );
}

export default function MeetingDetailPage() {
  const { meetingId } = useParams();
  const { user } = useAuth();
  const meeting = useMeeting(meetingId);
  const cancel = useCancelMeeting();
  const [confirming, setConfirming] = useState(false);

  const onCancel = async (reason) => {
    try {
      await cancel.mutateAsync({ id: meetingId, reason });
      toast.success('Meeting cancelled. Invitees are notified.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <Link
        to={teacherPaths.meetings()}
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2' })}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All meetings
      </Link>
      <QueryState
        query={meeting}
        loading={
          <div aria-busy="true" aria-label="Loading meeting" className="flex flex-col gap-4">
            <SkeletonCard />
            <Skeleton className="h-64 rounded-card" />
          </div>
        }
      >
        {(m) => {
          const state = meetingState(m);
          const organiser = String(m.organizerId?._id) === String(user?._id ?? user?.id);
          const canChange = organiser && state === 'upcoming';
          const Where = m.onlineLink ? Video : MapPin;
          return (
            <>
              <PageHeader
                title={m.title}
                description={meetingTypeLabel(m.type)}
                actions={
                  <>
                    <StatusBadge group="meeting" value={state} />
                    {canChange && (
                      <>
                        <Link
                          to={teacherPaths.editMeeting(m._id)}
                          className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          Edit
                        </Link>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          icon={CalendarX}
                          onClick={() => setConfirming(true)}
                        >
                          Cancel meeting
                        </Button>
                      </>
                    )}
                  </>
                }
              />
              {state === 'cancelled' && (
                <Alert tone="error" title="Cancelled" className="mb-4">
                  {m.cancelReason || 'This meeting was cancelled.'}
                </Alert>
              )}
              <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
                <Card title="Details">
                  <dl className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <dt className="sr-only">When</dt>
                      <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
                      <dd>
                        {formatDateTime(m.dateTime, { weekday: true })}
                        {m.durationMinutes && (
                          <span className="text-muted"> · {m.durationMinutes} minutes</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="sr-only">Where</dt>
                      <Where aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
                      <dd>
                        {m.venue ||
                          (m.onlineLink && (
                            <a
                              href={m.onlineLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-brand-700 underline"
                            >
                              Join online <ExternalLink aria-hidden="true" className="size-4" />
                            </a>
                          ))}
                      </dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="sr-only">Invited</dt>
                      <UsersRound
                        aria-hidden="true"
                        className="mt-0.5 size-5 shrink-0 text-brand-700"
                      />
                      <dd>
                        {plural(
                          m.inviteeStudentIds?.length ?? 0,
                          "student's guardian",
                          "students' guardians",
                        )}
                        {m.inviteeTeacherIds?.length
                          ? ` · ${plural(m.inviteeTeacherIds.length, 'teacher')}`
                          : ''}
                        <span className="block text-sm text-muted">
                          Organised by {organiser ? 'you' : m.organizerId?.name}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  {m.agenda && (
                    <div className="mt-4 border-t border-line pt-4">
                      <h3 className="font-semibold">Agenda</h3>
                      <p className="mt-1 whitespace-pre-line text-muted">{m.agenda}</p>
                    </div>
                  )}
                </Card>
                <Card title="Replies">
                  {organiser ? (
                    <Responses meetingId={m._id} />
                  ) : (
                    <EmptyState
                      compact
                      icon={UsersRound}
                      title="Replies are visible to the organiser"
                    />
                  )}
                </Card>
              </div>
              <ConfirmDialog
                open={confirming}
                onClose={() => setConfirming(false)}
                onConfirm={onCancel}
                loading={cancel.isPending}
                title="Cancel this meeting?"
                message="Everyone invited gets a notification with your reason."
                confirmLabel="Cancel meeting"
                cancelLabel="Keep meeting"
                reason={{ label: 'Reason', placeholder: 'e.g. The school is closed that day' }}
              />
            </>
          );
        }}
      </QueryState>
    </>
  );
}

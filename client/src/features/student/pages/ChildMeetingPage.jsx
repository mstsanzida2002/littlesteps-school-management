import {
  ArrowLeft,
  CalendarX,
  Clock,
  ExternalLink,
  MapPin,
  NotebookText,
  UserRound,
} from 'lucide-react';
import { Link, useParams } from 'react-router';

import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { studentPaths } from '../../../config/paths.js';
import { formatDateTime } from '../../../utils/date.js';
import { isObjectId } from '../../../utils/ids.js';
import {
  AddToCalendarButton,
  MeetingStateBadge,
  ReplyBadge,
  RsvpForm,
} from '../../meetings/components/GuardianMeeting.jsx';
import { useMeeting } from '../../meetings/hooks/useMeetings.js';
import { meetingState } from '../../meetings/labels.js';
import { text } from '../../meetings/text/index.js';
import ChildNotFound, { ChildQuery } from '../components/ChildNotFound.jsx';

const BANGLA = /[ঀ-৿]/;

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 py-3">
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
      <div className="min-w-0">
        <dt className="text-sm font-semibold text-muted">{label}</dt>
        <dd className="mt-0.5 text-ink">{children}</dd>
      </div>
    </div>
  );
}

/** One invitation (FR-STU-06/07). Meetings the child isn't invited to are 404 → "not found". */
export default function ChildMeetingPage() {
  const { meetingId } = useParams();
  const valid = isObjectId(meetingId);
  // A mangled address never reaches the API: it is simply "not found".
  const meeting = useMeeting(valid ? meetingId : undefined);
  if (!valid) return <ChildNotFound />;

  return (
    <>
      <Link
        to={studentPaths.meetings()}
        className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-700"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {text.back}
      </Link>
      <ChildQuery
        query={meeting}
        loading={
          <div aria-busy="true" aria-label={text.loading} className="flex flex-col gap-4">
            <Skeleton className="h-9 w-72" />
            <SkeletonCard />
          </div>
        }
      >
        {(m) => {
          const state = meetingState(m);
          const organiser = m.organizerId;
          return (
            <>
              <PageHeader
                title={m.title}
                description={text.types[m.type] ?? text.types.other}
                actions={<MeetingStateBadge meeting={m} size="md" />}
              />
              {state === 'cancelled' && (
                <div
                  role="status"
                  className="mb-4 flex gap-3 rounded-control border-2 border-cerise-200 bg-absent-soft p-4 text-absent-ink"
                >
                  <CalendarX aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
                  <div>
                    <p className="text-lg font-bold">{text.cancelled.title}</p>
                    <p className="mt-0.5">
                      {m.cancelReason
                        ? text.cancelled.reason(m.cancelReason)
                        : text.cancelled.noReason}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
                <Card>
                  <dl className="flex flex-col divide-y divide-line">
                    <Detail icon={Clock} label={text.when}>
                      <span className="font-semibold">
                        {formatDateTime(m.dateTime, { weekday: true })}
                      </span>
                      {m.durationMinutes && (
                        <span className="block text-sm text-muted">
                          {text.duration(m.durationMinutes)}
                        </span>
                      )}
                    </Detail>
                    <Detail icon={MapPin} label={text.where}>
                      {m.venue && <span className="block font-semibold">{m.venue}</span>}
                      {m.onlineLink && (
                        <span className="block">
                          {!m.venue && <span className="block font-semibold">{text.online}</span>}
                          {state !== 'cancelled' && (
                            <a
                              href={m.onlineLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={buttonClasses({
                                variant: 'secondary',
                                size: 'sm',
                                className: 'mt-2',
                              })}
                            >
                              <ExternalLink aria-hidden="true" className="size-4" />
                              {text.joinOnline}
                            </a>
                          )}
                        </span>
                      )}
                    </Detail>
                    {m.agenda && (
                      <Detail icon={NotebookText} label={text.agenda}>
                        <span
                          lang={BANGLA.test(m.agenda) ? 'bn' : undefined}
                          className="whitespace-pre-line"
                        >
                          {m.agenda}
                        </span>
                      </Detail>
                    )}
                    {organiser && (
                      <Detail icon={UserRound} label={text.organiser}>
                        {organiser.name}
                        {text.organiserRole[organiser.role] && (
                          <span className="text-muted">
                            {' '}
                            · {text.organiserRole[organiser.role]}
                          </span>
                        )}
                      </Detail>
                    )}
                  </dl>
                  {state === 'upcoming' && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-line pt-4">
                      <AddToCalendarButton meeting={m} className="self-start" />
                      <p className="text-sm text-muted">{text.calendarNote}</p>
                    </div>
                  )}
                </Card>

                {state !== 'cancelled' && (
                  <Card title={text.rsvp.title}>
                    {m.canRespond ? (
                      <RsvpForm meeting={m} />
                    ) : (
                      <div className="flex flex-col items-start gap-2">
                        <ReplyBadge response={m.myResponse?.response} size="md" />
                        {m.myResponse?.note && <p className="text-muted">“{m.myResponse.note}”</p>}
                        <p className="text-muted">{text.rsvp.closedStarted}</p>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </>
          );
        }}
      </ChildQuery>
    </>
  );
}

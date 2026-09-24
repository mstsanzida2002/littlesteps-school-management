/**
 * Guardian-side meeting pieces: the list card, the quick reply buttons (dashboard, list), the
 * reply form with a note (details page) and "Add to calendar".
 */
import {
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  CircleX,
  LoaderCircle,
  MapPin,
  Video,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { toast } from '../../../components/ui/toast.js';
import { studentPaths } from '../../../config/paths.js';
import { errorMessage } from '../../../lib/errorMessages.js';
import { cn } from '../../../utils/cn.js';
import { downloadIcs } from '../../../utils/ics.js';
import { useRespondToMeeting } from '../hooks/useMeetings.js';
import { meetingState, meetingWhenWhere } from '../labels.js';
import { text } from '../text/index.js';

const REPLIES = [
  { value: 'will_attend', icon: CircleCheck, tone: 'present' },
  { value: 'cannot_attend', icon: CircleX, tone: 'absent' },
];

const SELECTED = {
  present: 'border-present bg-present-soft text-present-ink',
  absent: 'border-absent bg-absent-soft text-absent-ink',
};

/** State badge with the guardian's words. */
export function MeetingStateBadge({ meeting, size = 'sm' }) {
  const state = meetingState(meeting);
  return <StatusBadge group="meeting" value={state} size={size} label={text.state[state]} />;
}

/** The guardian's reply as a badge ("Will attend" / "No reply yet"). */
export function ReplyBadge({ response, size = 'sm' }) {
  return (
    <StatusBadge
      group="rsvp"
      value={response ?? null}
      size={size}
      label={text.reply[response ?? 'no_response']}
    />
  );
}

/**
 * Two big buttons that save the reply straight away (the note, if any, is kept). The current
 * reply is pressed (aria-pressed), shown by a check icon and border too, never colour alone.
 */
export function RsvpButtons({ meeting, className }) {
  const respond = useRespondToMeeting();
  const [pending, setPending] = useState(null);
  const current = meeting.myResponse?.response ?? null;

  const choose = async (response) => {
    if (response === current || respond.isPending) return;
    setPending(response);
    try {
      await respond.mutateAsync({ id: meeting._id, response, note: meeting.myResponse?.note });
      toast.success(text.rsvp.saved);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      role="group"
      aria-label={text.rsvp.quickLabel(meeting.title)}
      className={cn('grid grid-cols-2 gap-2', className)}
    >
      {REPLIES.map(({ value, icon: Icon, tone }) => {
        const selected = current === value;
        const busy = pending === value;
        const Shown = busy ? LoaderCircle : Icon;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            aria-busy={busy || undefined}
            disabled={respond.isPending}
            onClick={() => choose(value)}
            className={cn(
              'flex min-h-12 items-center justify-center gap-1.5 rounded-control border-2 px-1 text-[0.95rem] font-bold whitespace-nowrap transition-colors disabled:opacity-70',
              selected
                ? SELECTED[tone]
                : 'border-line-strong bg-surface text-ink hover:bg-blush-50',
            )}
          >
            <Shown
              aria-hidden="true"
              className={cn('size-[1.1rem] shrink-0', busy && 'animate-spin')}
            />
            {text.reply[value]}
          </button>
        );
      })}
    </div>
  );
}

/** Details page: choose a reply, add an optional note, save. */
export function RsvpForm({ meeting }) {
  const respond = useRespondToMeeting();
  const [response, setResponse] = useState(meeting.myResponse?.response ?? null);
  const [note, setNote] = useState(meeting.myResponse?.note ?? '');
  const [error, setError] = useState(null);
  const changed =
    response !== (meeting.myResponse?.response ?? null) ||
    note.trim() !== (meeting.myResponse?.note ?? '');

  const save = async (event) => {
    event.preventDefault();
    if (!response) return;
    setError(null);
    try {
      await respond.mutateAsync({ id: meeting._id, response, note: note.trim() || undefined });
      toast.success(text.rsvp.saved);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <fieldset>
        {/* The card around the form shows the same question as its title. */}
        <legend className="sr-only">{text.rsvp.title}</legend>
        <div className="grid grid-cols-2 gap-2">
          {REPLIES.map(({ value, icon: Icon, tone }) => {
            const selected = response === value;
            return (
              <label
                key={value}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center justify-center gap-1.5 rounded-control border-2 px-1 font-bold whitespace-nowrap has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus',
                  selected ? SELECTED[tone] : 'border-line-strong bg-surface text-ink',
                )}
              >
                <input
                  type="radio"
                  name="response"
                  value={value}
                  checked={selected}
                  onChange={() => setResponse(value)}
                  className="sr-only"
                />
                <Icon aria-hidden="true" className="size-5" />
                {text.reply[value]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <FormField label={text.rsvp.note}>
        <Textarea
          rows={2}
          maxLength={300}
          value={note}
          placeholder={text.rsvp.notePlaceholder}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormField>
      {error && (
        <p role="alert" className="font-semibold text-absent-ink">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={!response || !changed} loading={respond.isPending}>
          {text.rsvp.save}
        </Button>
        <p className="text-sm text-muted">{text.rsvp.changeHint}</p>
      </div>
    </form>
  );
}

/** Downloads an .ics file (UTC times, so calendars show the right Dhaka time). */
export function AddToCalendarButton({ meeting, className }) {
  return (
    <Button
      variant="secondary"
      icon={CalendarPlus}
      className={className}
      onClick={() =>
        downloadIcs({
          uid: `${meeting._id}@littlesteps`,
          title: meeting.title,
          start: meeting.dateTime,
          durationMinutes: meeting.durationMinutes,
          location: meeting.venue || meeting.onlineLink,
          description: meeting.agenda,
          url: meeting.onlineLink,
        })
      }
    >
      {text.addToCalendar}
    </Button>
  );
}

/** A meeting in a list: title, state, when and where, the reply; opens the details. */
export function GuardianMeetingCard({ meeting, quickReply = false }) {
  const Where = meeting.onlineLink && !meeting.venue ? Video : MapPin;
  const state = meetingState(meeting);
  return (
    <li className="rounded-card border border-line bg-surface shadow-card">
      <Link
        to={studentPaths.meeting(meeting._id)}
        className="flex items-center gap-3 rounded-card p-4 transition-colors hover:bg-blush-50"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{meeting.title}</span>
            <MeetingStateBadge meeting={meeting} />
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
            <Where aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {meetingWhenWhere(meeting)}
          </p>
          {state !== 'cancelled' && (
            <p className="mt-1.5">
              <ReplyBadge response={meeting.myResponse?.response} />
            </p>
          )}
        </div>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-sand-400" />
      </Link>
      {quickReply && meeting.canRespond && (
        <RsvpButtons meeting={meeting} className="border-t border-line p-3" />
      )}
    </li>
  );
}

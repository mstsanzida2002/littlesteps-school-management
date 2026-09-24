/**
 * The single mapping from every status value the API returns to how the UI shows it.
 * Every status has an icon AND a label, so it is never told apart by colour alone (WCAG 1.4.1).
 * Tones are the colour families in index.css (present, absent, late, excused, neutral, info).
 *
 * Render with <StatusBadge group="attendance" value={record.status} />, or read the meta with
 * getStatus(group, value) for custom layouts (table cells, chart legends).
 */
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  CircleCheckBig,
  CircleDotDashed,
  CircleDashed,
  CircleMinus,
  CircleX,
  Clock,
  Contrast,
  Moon,
  Hourglass,
  PencilLine,
  Send,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';

export const TONES = Object.freeze(['present', 'absent', 'late', 'excused', 'neutral', 'info']);

const define = (entries) => Object.freeze(entries);

export const STATUS_GROUPS = Object.freeze({
  /** Attendance.status, and Result.attendance (present | absent | excused). */
  attendance: define({
    present: { label: 'Present', icon: CircleCheck, tone: 'present' },
    absent: { label: 'Absent', icon: CircleX, tone: 'absent' },
    late: { label: 'Late', icon: Clock, tone: 'late' },
    excused: { label: 'Excused', icon: ShieldCheck, tone: 'excused' },
  }),
  /** Assessment.status and Notice.status. */
  publication: define({
    draft: { label: 'Draft', icon: PencilLine, tone: 'neutral' },
    published: { label: 'Published', icon: Send, tone: 'info' },
  }),
  /** User.status. */
  account: define({
    pending: { label: 'Pending', icon: Hourglass, tone: 'late' },
    active: { label: 'Active', icon: UserCheck, tone: 'present' },
    suspended: { label: 'Suspended', icon: Ban, tone: 'absent' },
    rejected: { label: 'Rejected', icon: UserX, tone: 'neutral' },
  }),
  /** A student's meeting response; `no_response` when they have not answered yet. */
  rsvp: define({
    will_attend: { label: 'Will attend', icon: CircleCheck, tone: 'present' },
    cannot_attend: { label: 'Cannot attend', icon: CircleX, tone: 'absent' },
    no_response: { label: 'No response', icon: CircleDashed, tone: 'neutral' },
  }),
  /** Attendance taking for a class-section today (GET /api/attendance/today). */
  marking: define({
    marked: { label: 'Marked', icon: CircleCheckBig, tone: 'present' },
    partial: { label: 'Partly marked', icon: CircleDotDashed, tone: 'late' },
    pending: { label: 'To mark', icon: Hourglass, tone: 'info' },
  }),
  /**
   * One school day on the guardian's calendar (features/attendance/guardianDays.js): the day's
   * subject records combined, plus days without classes.
   */
  day: define({
    present: { label: 'Present', icon: CircleCheck, tone: 'present' },
    absent: { label: 'Absent', icon: CircleX, tone: 'absent' },
    late: { label: 'Late', icon: Clock, tone: 'late' },
    partial: { label: 'Part of the day', icon: Contrast, tone: 'late' },
    no_class: { label: 'No class', icon: CircleMinus, tone: 'neutral' },
    off_day: { label: 'Off day', icon: Moon, tone: 'neutral' },
  }),
  /** Derived meeting state (from cancelledAt and dateTime). */
  meeting: define({
    upcoming: { label: 'Upcoming', icon: CalendarClock, tone: 'info' },
    past: { label: 'Held', icon: CalendarCheck, tone: 'neutral' },
    cancelled: { label: 'Cancelled', icon: CalendarX, tone: 'absent' },
  }),
});

/** Values that mean "nothing recorded yet" for each group (null / undefined from the API). */
const EMPTY_VALUE = Object.freeze({ rsvp: 'no_response' });

const humanize = (value) =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

/**
 * { label, icon, tone } for a status. Unknown values still render (neutral, humanized label),
 * so a new server status never crashes the UI.
 */
export function getStatus(group, value) {
  const statuses = STATUS_GROUPS[group];
  if (!statuses) throw new Error(`Unknown status group "${group}"`);
  const key = value ?? EMPTY_VALUE[group];
  if (key != null && Object.hasOwn(statuses, key)) return statuses[key];
  return { label: key == null ? 'Not set' : humanize(key), icon: CircleDashed, tone: 'neutral' };
}

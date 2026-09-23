/**
 * Client-side counterpart of server/src/utils/date.js. All date display/"today" logic in the
 * client goes through here.
 *
 * School dates (attendance dates etc.) arrive from the API as UTC-midnight ISO strings
 * ('2026-09-23T00:00:00.000Z') or 'YYYY-MM-DD' keys. They are calendar dates — always format
 * them in UTC so a viewer's own timezone can never shift the day.
 * Real instants (createdAt, meeting dateTime) are shown in the school timezone.
 */
import { SCHOOL_TIMEZONE } from '../config/constants.js';

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date key ('YYYY-MM-DD') in Asia/Dhaka — use for default date pickers / API params. */
export function todayDateKey(now = new Date()) {
  const parts = Object.fromEntries(
    dateKeyFormatter.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Format a school date (UTC-midnight ISO or 'YYYY-MM-DD') for display, e.g. "23 Sep 2026". */
export function formatSchoolDate(
  value,
  options = { day: 'numeric', month: 'short', year: 'numeric' },
) {
  if (!value) return '';
  const iso = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(iso));
}

/** Format a real instant in the school timezone, e.g. "23 Sep 2026, 10:30 am". */
export function formatDateTime(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: SCHOOL_TIMEZONE }).format(
    new Date(value),
  );
}

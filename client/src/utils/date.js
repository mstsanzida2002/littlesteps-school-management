/**
 * Client-side counterpart of server/src/utils/date.js. All date display/"today" logic in the
 * client goes through here.
 *
 * School dates (attendance dates etc.) arrive from the API as UTC-midnight ISO strings
 * ('2026-09-23T00:00:00.000Z') or 'YYYY-MM-DD' keys. They are calendar dates — always format
 * them in UTC so a viewer's own timezone can never shift the day.
 * Real instants (createdAt, meeting dateTime) are shown in the school timezone.
 *
 * Display strings are assembled from en-US parts ("Thu, 24 Sep 2026"): en-GB now prints "Sept".
 */
import { SCHOOL_TIMEZONE } from '../config/constants.js';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const partsFormatter = (timeZone) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
const utcParts = partsFormatter('UTC');
const schoolParts = partsFormatter(SCHOOL_TIMEZONE);

const partsOf = (formatter, date) =>
  Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));

/** A school date value ('YYYY-MM-DD' or UTC-midnight ISO) as a Date at UTC midnight. */
const schoolDateToDate = (value) =>
  new Date(typeof value === 'string' && DATE_KEY_RE.test(value) ? `${value}T00:00:00.000Z` : value);

/** True for a real calendar date written as 'YYYY-MM-DD'. */
export function isDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  return schoolDateToDate(value).toISOString().slice(0, 10) === value;
}

/** Today's date key ('YYYY-MM-DD') in Asia/Dhaka — use for default date pickers / API params. */
export function todayDateKey(now = new Date()) {
  const parts = partsOf(dateKeyFormatter, now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The date key n days after (or before, for negative n) a date key. */
export function addDaysToKey(key, days) {
  return new Date(schoolDateToDate(key).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Every date key from `from` to `to`, inclusive. */
export function eachDateKey(from, to) {
  const keys = [];
  for (let key = from; key <= to; key = addDaysToKey(key, 1)) keys.push(key);
  return keys;
}

/** 0 = Sunday … 6 = Saturday, for a school date. */
export function weekdayOfKey(key) {
  return schoolDateToDate(key).getUTCDay();
}

/**
 * Format a school date (UTC-midnight ISO or 'YYYY-MM-DD'), e.g. "23 Sep 2026",
 * "Wed, 23 Sep 2026" ({ weekday: true }) or "23 Sep" ({ year: false }).
 */
export function formatSchoolDate(value, { weekday = false, year = true } = {}) {
  if (!value) return '';
  const p = partsOf(utcParts, schoolDateToDate(value));
  return `${weekday ? `${p.weekday}, ` : ''}${p.day} ${p.month}${year ? ` ${p.year}` : ''}`;
}

/** Format a real instant in the school timezone, e.g. "23 Sep 2026, 10:30 am". */
export function formatDateTime(value, { weekday = false } = {}) {
  if (!value) return '';
  const p = partsOf(schoolParts, new Date(value));
  const date = `${weekday ? `${p.weekday}, ` : ''}${p.day} ${p.month} ${p.year}`;
  return `${date}, ${p.hour}:${p.minute} ${p.dayPeriod.toLowerCase()}`;
}

const dhakaPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** A real instant as the Dhaka wall-clock date and time: { date: 'YYYY-MM-DD', time: 'HH:mm' }. */
export function schoolDateTimeParts(value) {
  const p = partsOf(dhakaPartsFormatter, new Date(value));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** "10:00 am" for a real instant, in Dhaka. */
export function formatSchoolTime(value) {
  const p = partsOf(schoolParts, new Date(value));
  return `${p.hour}:${p.minute} ${p.dayPeriod.toLowerCase()}`;
}

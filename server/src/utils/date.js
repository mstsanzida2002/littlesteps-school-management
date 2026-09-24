/**
 * THE shared date utility. All calendar-date logic (attendance dates, "today",
 * month ranges) must go through this module — never use `new Date()` arithmetic
 * or `setHours(0,0,0,0)` directly in services/controllers.
 *
 * Convention:
 *  - A "school date" is a calendar date interpreted in SCHOOL_TIMEZONE (Asia/Dhaka).
 *  - It is stored in MongoDB as a Date at UTC midnight of that calendar date
 *    (e.g. 2026-09-23 in Dhaka → 2026-09-23T00:00:00.000Z).
 *  - A "date key" is the 'YYYY-MM-DD' string form used in APIs and query params.
 */
import { SCHOOL_TIMEZONE, WEEKDAYS } from '../config/constants.js';

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const schoolDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const schoolDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** True if `value` is a real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-30). */
export function isValidDateKey(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Calendar date key ('YYYY-MM-DD') of an instant, as seen on a clock in Asia/Dhaka. */
export function schoolDateKeyOf(instant) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid instant: ${instant}`);
  const parts = Object.fromEntries(
    schoolDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Normalize input into a stored school date (UTC midnight).
 *  - 'YYYY-MM-DD' string → that calendar date as-is (no timezone shift).
 *  - Date / timestamp    → the Asia/Dhaka calendar date of that instant.
 */
export function toSchoolDate(input) {
  if (typeof input === 'string' && DATE_KEY_RE.test(input)) {
    if (!isValidDateKey(input)) throw new RangeError(`Invalid calendar date: ${input}`);
    return new Date(`${input}T00:00:00.000Z`);
  }
  return new Date(`${schoolDateKeyOf(input)}T00:00:00.000Z`);
}

/** Today's school date (UTC midnight of today's date in Asia/Dhaka). */
export function todaySchoolDate(now = new Date()) {
  return toSchoolDate(now);
}

/** Stored school date → 'YYYY-MM-DD'. */
export function toDateKey(schoolDate) {
  assertNormalized(schoolDate);
  return schoolDate.toISOString().slice(0, 10);
}

/** True if a Date is exactly UTC midnight (i.e. a correctly stored school date). */
export function isNormalizedSchoolDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) && date.getTime() % MS_PER_DAY === 0;
}

export function addDays(schoolDate, days) {
  assertNormalized(schoolDate);
  return new Date(schoolDate.getTime() + days * MS_PER_DAY);
}

/**
 * The real instant of a wall-clock time ('HH:mm') on a school date, in Asia/Dhaka.
 * e.g. atSchoolTime(toSchoolDate('2026-09-23'), '08:00') → 2026-09-23T02:00:00.000Z
 */
export function atSchoolTime(schoolDate, hhmm) {
  assertNormalized(schoolDate);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new RangeError(`Invalid time (expected HH:mm): ${hhmm}`);
  const wallClockAsUtc = schoolDate.getTime() + (Number(match[1]) * 60 + Number(match[2])) * 60_000;
  return new Date(wallClockAsUtc - schoolOffsetMs(new Date(wallClockAsUtc)));
}

/** Offset of SCHOOL_TIMEZONE from UTC at a given instant, in ms (Dhaka: +6h, no DST). */
function schoolOffsetMs(instant) {
  const parts = Object.fromEntries(
    schoolDateTimeFormatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  const wallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return wallClock - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Whole calendar days from `from` to `to` (both stored school dates); negative if `to` is earlier. */
export function daysBetween(from, to) {
  assertNormalized(from);
  assertNormalized(to);
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC', // stored school dates are UTC midnight of the calendar day
});

/** Human-readable school date for messages, e.g. "Thu, 24 Sep 2026" (locale-independent order). */
export function formatSchoolDateLong(schoolDate) {
  assertNormalized(schoolDate);
  const p = Object.fromEntries(
    longDateFormatter.formatToParts(schoolDate).map(({ type, value }) => [type, value]),
  );
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

/** Wall-clock time ('HH:mm') of an instant in Asia/Dhaka. */
export function schoolTimeOf(instant) {
  const parts = Object.fromEntries(
    schoolDateTimeFormatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return `${parts.hour}:${parts.minute}`;
}

/** A real instant shown in Dhaka time for messages, e.g. "Thu, 1 Oct 2026, 10:00". */
export function formatSchoolDateTime(instant) {
  const parts = Object.fromEntries(
    schoolDateTimeFormatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return `${formatSchoolDateLong(toSchoolDate(instant))}, ${parts.hour}:${parts.minute}`;
}

/** Weekday name ('sunday'…'saturday') of a stored school date. */
export function weekdayOf(schoolDate) {
  assertNormalized(schoolDate);
  return WEEKDAYS[schoolDate.getUTCDay()];
}

/**
 * Half-open range [start, end) of stored school dates for a calendar month.
 * `month` is 1–12. Use as { date: { $gte: start, $lt: end } }.
 */
export function monthRange(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid year/month: ${year}-${month}`);
  }
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

function assertNormalized(date) {
  if (!isNormalizedSchoolDate(date)) {
    throw new RangeError(`Expected a normalized school date (UTC midnight), got: ${date}`);
  }
}

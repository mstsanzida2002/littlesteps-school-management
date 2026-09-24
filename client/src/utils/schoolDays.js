/**
 * School-day helpers for the attendance date chips. Everything works on 'YYYY-MM-DD' Dhaka keys
 * (utils/date.js), with the rules from GET /api/settings/school.
 */
import { addDaysToKey, formatSchoolDate, weekdayOfKey } from './date.js';

export const WEEKDAY_NAMES = Object.freeze([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

export const isOffDay = (key, offDays = []) => offDays.includes(WEEKDAY_NAMES[weekdayOfKey(key)]);

/**
 * The days a teacher may take or change attendance for, newest first: today and each earlier
 * day within `backdateDays` calendar days (the server's BACKDATE_LIMIT rule), skipping weekly
 * off days and days before the session starts.
 */
export function markableSchoolDays({
  today,
  backdateDays = 7,
  offDays = [],
  sessionStart,
  sessionEnd,
}) {
  const days = [];
  for (let back = 0; back <= backdateDays; back += 1) {
    const key = addDaysToKey(today, -back);
    if (sessionStart && key < sessionStart) break;
    if (sessionEnd && key > sessionEnd) continue;
    if (!isOffDay(key, offDays)) days.push(key);
  }
  return days;
}

/** Chip label: "Today", or "Wed 23 Sep". */
export function dayChipLabel(key, today) {
  if (key === today) return 'Today';
  return formatSchoolDate(key, { weekday: true, year: false }).replace(',', '');
}

/**
 * Day statuses for the guardian's attendance calendar. A school day has one record per subject;
 * the guardian sees one status per day (config/statuses.js, group "day"):
 *
 * - absent:   absent in every recorded subject
 * - partial:  absent in some subjects, there in others ("Part of the day")
 * - late:     there all day, late for at least one subject
 * - present:  there all day
 * - no_class: a school day (from admission to today) with nothing recorded
 * - off_day:  a weekly off day (Settings.weeklyOffDays)
 * - null:     not a day to show a status for (future, before admission, outside the school year)
 */
import { eachDateKey, monthBounds, weekdayOfKey } from '../../utils/date.js';
import { WEEKDAY_NAMES } from '../../utils/schoolDays.js';

/** One status for a day's records (each { status: 'present' | 'absent' | 'late' }). */
export function guardianDayStatus(records) {
  if (!records?.length) return null;
  const absent = records.filter((r) => r.status === 'absent').length;
  if (absent === records.length) return 'absent';
  if (absent > 0) return 'partial';
  if (records.some((r) => r.status === 'late')) return 'late';
  return 'present';
}

/** History records → Map(date → records of that day). */
export function recordsByDay(history = []) {
  const days = new Map();
  for (const record of history) {
    if (!days.has(record.date)) days.set(record.date, []);
    days.get(record.date).push(record);
  }
  return days;
}

/**
 * Every day of a month with its status and records.
 * @param month     'YYYY-MM'
 * @param history   the month's records ({ date, subject, teacher, status })
 * @param offDays   weekday names ('friday', …)
 * @param today     today's Dhaka date key
 * @param from, to  the first and last days that can have classes (admission or school-year
 *                  start; school-year end)
 */
export function monthDays({ month, history = [], offDays = [], today, from, to }) {
  const byDay = recordsByDay(history);
  const off = new Set(offDays.map((day) => WEEKDAY_NAMES.indexOf(day)));
  const { from: first, to: last } = monthBounds(month);
  return eachDateKey(first, last).map((date) => {
    const records = byDay.get(date) ?? [];
    let status = guardianDayStatus(records);
    if (!status) {
      const inRange = (!from || date >= from) && (!to || date <= to) && date <= today;
      if (off.has(weekdayOfKey(date))) status = 'off_day';
      else if (inRange) status = 'no_class';
    }
    return { date, status, records };
  });
}

/** Counts of each status in a month's days, for the calendar summary. */
export function countDays(days) {
  const counts = {};
  for (const { status } of days) if (status) counts[status] = (counts[status] ?? 0) + 1;
  return counts;
}

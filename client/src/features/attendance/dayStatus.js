/**
 * One status per day for the calendar, from per-subject history records: absent if any subject
 * was, then late, then excused, otherwise present. Oldest first.
 */
export function dayStatuses(history) {
  const days = new Map();
  for (const record of history) {
    if (!days.has(record.date)) days.set(record.date, []);
    days.get(record.date).push(record.status);
  }
  return [...days.entries()]
    .map(([date, statuses]) => ({
      date,
      status: ['absent', 'late', 'excused', 'present'].find((s) => statuses.includes(s)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Plain-language summaries of chart data. Every chart shows one under it and uses it as its
 * accessible name, so the chart is never the only way to get the information.
 */
import { formatSchoolDate } from '../../utils/date.js';
import { formatPercent, plural } from '../../utils/format.js';

const avg = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * Daily rates: [{ date: 'YYYY-MM-DD', value: number | null }].
 * "Average 91.4% over 22 school days. Lowest 78% on 15 Sep, latest 95% on 24 Sep. 2 days below 75%."
 */
export function summarizeTrend(points, { threshold, unit = 'school day' } = {}) {
  const known = points.filter((p) => p.value != null);
  if (!known.length) return 'No records yet.';
  const lowest = known.reduce((min, p) => (p.value < min.value ? p : min));
  const latest = known.at(-1);
  const parts = [
    `Average ${formatPercent(avg(known.map((p) => p.value)))} over ${plural(known.length, unit)}.`,
    `Lowest ${formatPercent(lowest.value)} on ${formatSchoolDate(lowest.date, { year: false })}, latest ${formatPercent(latest.value)} on ${formatSchoolDate(latest.date, { year: false })}.`,
  ];
  if (threshold != null) {
    const below = known.filter((p) => p.value < threshold).length;
    parts.push(
      below
        ? `${plural(below, 'day')} below ${formatPercent(threshold)}.`
        : `No day below ${formatPercent(threshold)}.`,
    );
  }
  return parts.join(' ');
}

/**
 * Items: [{ label, value: number | null }].
 * "Highest KG-1 (96%), lowest Nursery (88%). Below 75%: Playgroup-B."
 */
export function summarizeComparison(items, { threshold } = {}) {
  const known = items.filter((i) => i.value != null);
  if (!known.length) return 'No records yet.';
  if (known.length === 1) return `${known[0].label}: ${formatPercent(known[0].value)}.`;
  const sorted = [...known].sort((a, b) => b.value - a.value);
  const parts = [
    `Highest ${sorted[0].label} (${formatPercent(sorted[0].value)}), lowest ${sorted.at(-1).label} (${formatPercent(sorted.at(-1).value)}).`,
  ];
  if (threshold != null) {
    const below = known.filter((i) => i.value < threshold).map((i) => i.label);
    parts.push(
      below.length
        ? `Below ${formatPercent(threshold)}: ${below.join(', ')}.`
        : `All at or above ${formatPercent(threshold)}.`,
    );
  }
  return parts.join(' ');
}

/**
 * Calendar of statuses: [{ date, status }] where status is present | absent | late | excused.
 * "22 school days recorded: 19 present, 2 absent, 1 late. Last absence: 15 Sep."
 */
export function summarizeCalendar(days) {
  const recorded = days.filter((d) => d.status);
  if (!recorded.length) return 'No attendance recorded yet.';
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  recorded.forEach((d) => {
    if (d.status in counts) counts[d.status] += 1;
  });
  const listed = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([status, n]) => `${n} ${status}`)
    .join(', ');
  const lastAbsence = recorded.filter((d) => d.status === 'absent').at(-1);
  return [
    `${plural(recorded.length, 'school day')} recorded: ${listed}.`,
    lastAbsence
      ? `Last absence: ${formatSchoolDate(lastAbsence.date, { year: false })}.`
      : 'No absences.',
  ].join(' ');
}

import { getStatus, STATUS_GROUPS } from '../../config/statuses.js';
import { cn } from '../../utils/cn.js';
import { addDaysToKey, eachDateKey, formatSchoolDate, weekdayOfKey } from '../../utils/date.js';
import { TONE_SOFT } from '../ui/tones.js';
import { ChartFigure } from './ChartFigure.jsx';
import { summarizeCalendar } from './summaries.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Month key 'YYYY-MM' → "September 2026" (formatted from the 1st, in UTC). */
const monthTitle = (monthKey) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${monthKey}-01T00:00:00.000Z`),
  );

/** Split the range into months, each padded to whole weeks (Sunday first). */
function monthsOf(from, to) {
  const months = [];
  for (const key of eachDateKey(from, to)) {
    const month = key.slice(0, 7);
    if (months.at(-1)?.month !== month) months.push({ month, keys: [] });
    months.at(-1).keys.push(key);
  }
  return months.map(({ month, keys }) => {
    const cells = [...Array(weekdayOfKey(keys[0])).fill(null), ...keys];
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { month, weeks };
  });
}

/**
 * Attendance calendar: month grids, one cell per day with the date and the status icon, so
 * statuses are told apart by icon (and label, on hover and for screen readers), not colour
 * alone. Built with CSS grid; Recharts has no calendar chart.
 *
 * days: [{ date: 'YYYY-MM-DD', status: 'present' | 'absent' | 'late' | 'excused' }]
 * `offDays`: weekday numbers not taught (Settings.weeklyOffDays, default Fri + Sat).
 */
export function CalendarHeatmap({ title, days, from, to, offDays = [5, 6], className }) {
  const byDate = new Map(days.map((d) => [d.date, d.status]));
  const start = from ?? days[0]?.date;
  const end = to ?? days.at(-1)?.date ?? start;
  const summary = summarizeCalendar(days);
  if (!start) return <ChartFigure title={title} summary={summary} empty className={className} />;
  // At most ~13 months, so a bad range can't render thousands of cells.
  const last = end > addDaysToKey(start, 400) ? addDaysToKey(start, 400) : end;

  return (
    <ChartFigure title={title} summary={summary} className={cn('max-w-[26rem]', className)}>
      <div className="flex flex-col gap-5">
        {monthsOf(start, last).map(({ month, weeks }) => (
          <div key={month}>
            <p aria-hidden="true" className="mb-1.5 text-sm font-bold text-sand-700">
              {monthTitle(month)}
            </p>
            <div
              aria-hidden="true"
              className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted"
            >
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div aria-hidden="true" className="mt-1 grid grid-cols-7 gap-1">
              {weeks.flat().map((key, i) => {
                if (!key) return <span key={`pad-${i}`} />;
                const status = byDate.get(key);
                const off = offDays.includes(weekdayOfKey(key));
                const meta = status ? getStatus('attendance', status) : null;
                const Icon = meta?.icon;
                return (
                  <span
                    key={key}
                    title={`${formatSchoolDate(key, { weekday: true })}: ${meta?.label ?? (off ? 'No school' : 'Not recorded')}`}
                    className={cn(
                      'flex aspect-square min-h-9 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold tabular-nums',
                      meta
                        ? TONE_SOFT[meta.tone]
                        : off
                          ? 'text-sand-400'
                          : 'border border-dashed border-line-strong text-sand-600',
                    )}
                  >
                    {Number(key.slice(8))}
                    {Icon && <Icon className="size-3.5" />}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-sand-700">
          {Object.entries(STATUS_GROUPS.attendance).map(([value, meta]) => (
            <li key={value} className="inline-flex items-center gap-1.5">
              <span className={cn('grid size-5 place-items-center rounded', TONE_SOFT[meta.tone])}>
                <meta.icon className="size-3.5" />
              </span>
              {meta.label}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span className="size-5 rounded border border-dashed border-line-strong" />
            Not recorded
          </li>
        </ul>
      </div>
    </ChartFigure>
  );
}

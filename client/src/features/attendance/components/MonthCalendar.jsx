import { ChevronLeft, ChevronRight } from 'lucide-react';

import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button, IconButton } from '../../../components/ui/Button.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { TONE_SOFT } from '../../../components/ui/tones.js';
import { getStatus } from '../../../config/statuses.js';
import { cn } from '../../../utils/cn.js';
import { formatMonth, formatSchoolDate, weekdayOfKey } from '../../../utils/date.js';
import { countDays } from '../guardianDays.js';
import { text } from '../text/index.js';

const LEGEND = ['present', 'late', 'partial', 'absent', 'no_class', 'off_day'];

/**
 * The guardian's month calendar: one button per day with the date, the status icon and (for
 * screen readers and on hover) its label, so a status is never told by colour alone. Tapping a
 * day opens its classes (DaySheet). Days without a status (future, before joining) are plain.
 *
 * days: monthDays() output — [{ date, status, records }]
 */
export function MonthCalendar({ month, days, selected, onSelect, onPrev, onNext, today }) {
  const lead = days.length ? weekdayOfKey(days[0].date) : 0;
  const counts = countDays(days);
  const monthLabel = formatMonth(month);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <IconButton
          icon={ChevronLeft}
          label={text.previousMonth}
          onClick={onPrev}
          disabled={!onPrev}
        />
        <h3 className="text-lg font-bold" aria-live="polite">
          {monthLabel}
        </h3>
        <IconButton
          icon={ChevronRight}
          label={text.nextMonth}
          onClick={onNext}
          disabled={!onNext}
        />
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted"
      >
        {text.weekdaysShort.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1" aria-label={monthLabel}>
        {days.map((day, i) => {
          const meta = day.status ? getStatus('day', day.status) : null;
          const Icon = meta?.icon;
          const label = day.status ? text.dayStatus[day.status] : text.noStatus;
          const dateLabel = formatSchoolDate(day.date, { weekday: true, year: false });
          const isSelected = selected === day.date;
          const cell = cn(
            'flex aspect-square min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-sm font-semibold tabular-nums',
            day.status === 'no_class' && 'border border-dashed border-line-strong text-sand-600',
            day.status === 'off_day' && 'text-sand-400',
            meta && !['no_class', 'off_day'].includes(day.status) && TONE_SOFT[meta.tone],
            !meta && 'text-sand-300',
            day.date === today && 'outline-2 outline-offset-1 outline-brand-400',
          );
          return (
            <li key={day.date} style={i === 0 ? { gridColumnStart: lead + 1 } : undefined}>
              {day.status ? (
                <button
                  type="button"
                  onClick={() => onSelect(day.date)}
                  aria-label={text.dayLabel(dateLabel, label)}
                  aria-pressed={isSelected}
                  title={text.dayLabel(dateLabel, label)}
                  className={cn(
                    cell,
                    'transition-transform active:scale-95',
                    isSelected && 'ring-3 ring-brand-800',
                  )}
                >
                  {Number(day.date.slice(8))}
                  {Icon && <Icon aria-hidden="true" className="size-3.5" />}
                </button>
              ) : (
                <span className={cell}>
                  <span className="sr-only">{text.dayLabel(dateLabel, label)}</span>
                  <span aria-hidden="true">{Number(day.date.slice(8))}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-muted">{text.monthSummary(monthLabel, counts)}</p>

      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-700">
          {text.legendTitle}
        </summary>
        <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {LEGEND.map((status) => {
            const meta = getStatus('day', status);
            return (
              <li key={status} className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded',
                    status === 'no_class'
                      ? 'border border-dashed border-line-strong text-sand-600'
                      : status === 'off_day'
                        ? 'text-sand-400'
                        : TONE_SOFT[meta.tone],
                  )}
                >
                  <meta.icon aria-hidden="true" className="size-3.5" />
                </span>
                {text.dayStatus[status]}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

/** One day's classes: each subject with its teacher and status. */
export function DaySheet({ day, today, onClose }) {
  const t = text.day;
  const title = day ? formatSchoolDate(day.date, { weekday: true }) : '';
  let body = null;
  if (day?.records.length) {
    body = (
      <>
        <div className="mb-3">
          <StatusBadge group="day" value={day.status} label={text.dayStatus[day.status]} />
        </div>
        <h3 className="mb-1 text-sm font-bold tracking-wide text-muted uppercase">{t.subjects}</h3>
        <ul className="flex flex-col divide-y divide-line">
          {day.records.map((r) => (
            <li key={r._id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block font-semibold">{r.subject}</span>
                {r.teacher && <span className="block text-sm text-muted">{t.by(r.teacher)}</span>}
              </span>
              <StatusBadge
                group="attendance"
                value={r.status}
                size="sm"
                label={text.recordStatus[r.status]}
              />
            </li>
          ))}
        </ul>
      </>
    );
  } else if (day) {
    const message = day.status === 'off_day' ? t.offDay : day.date > today ? t.future : t.noClass;
    body = <p className="text-muted">{message}</p>;
  }
  return (
    <Modal
      open={Boolean(day)}
      onClose={onClose}
      title={title}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      {body}
    </Modal>
  );
}

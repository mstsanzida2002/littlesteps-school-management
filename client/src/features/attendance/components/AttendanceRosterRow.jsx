import { memo, useId } from 'react';

import { Avatar } from '../../../components/ui/Avatar.jsx';
import { getStatus } from '../../../config/statuses.js';
import { cn } from '../../../utils/cn.js';

const OPTIONS = ['present', 'absent', 'late'];

const SELECTED = {
  present: 'border-present-ink bg-present-soft text-present-ink',
  absent: 'border-absent-ink bg-absent-soft text-absent-ink',
  late: 'border-late-ink bg-late-soft text-late-ink',
};

const BANGLA = /[ঀ-৿]/;

/**
 * One student on the take-attendance roster: avatar, name, roll and three large
 * Present / Absent / Late segments (native radios: arrow keys work, one tab stop per row).
 * Memoised, so a tap re-renders only this row. Phones: name above the buttons; wider: one line.
 */
export const AttendanceRosterRow = memo(function AttendanceRosterRow({
  student,
  status,
  onChange,
}) {
  const nameId = useId();
  return (
    <li
      data-status={status}
      className={cn(
        'flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4',
        status === 'absent' && 'bg-absent-soft/40',
        status === 'late' && 'bg-late-soft/40',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={student.name} />
        <div className="min-w-0">
          <p
            id={nameId}
            lang={BANGLA.test(student.name) ? 'bn' : undefined}
            className="truncate font-semibold text-ink"
          >
            {student.name}
          </p>
          <p className="text-sm text-muted">Roll {student.rollNo}</p>
        </div>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={nameId}
        className="grid grid-cols-3 gap-2 sm:w-[21rem]"
      >
        {OPTIONS.map((option) => {
          const meta = getStatus('attendance', option);
          const selected = status === option;
          return (
            <label
              key={option}
              className={cn(
                'flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-control border-2 px-2 text-sm font-semibold transition-colors select-none',
                'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                selected
                  ? SELECTED[option]
                  : 'border-line-strong bg-surface text-sand-700 hover:border-sand-300',
              )}
            >
              <input
                type="radio"
                name={`status-${student.studentId}`}
                value={option}
                checked={selected}
                onChange={() => onChange(student.studentId, option)}
                className="sr-only"
              />
              <meta.icon aria-hidden="true" className="size-5 shrink-0" />
              {meta.label}
            </label>
          );
        })}
      </div>
    </li>
  );
});

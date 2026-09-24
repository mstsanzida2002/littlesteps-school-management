import { cn } from '../../utils/cn.js';
import { formatSchoolDate, isDateKey, todayDateKey } from '../../utils/date.js';
import { fieldClasses } from './fieldStyles.js';

/**
 * School-date picker. The value is a 'YYYY-MM-DD' key in Asia/Dhaka — exactly what the API
 * takes — never a Date, so the viewer's own timezone can't shift the day.
 *
 * Native date input (the phone's own calendar), with the day written out below
 * ("Thu, 24 Sep 2026") so the chosen date is unambiguous. `showToday` adds a "Today" shortcut
 * (today in Dhaka). `min`/`max` are keys too, e.g. max={todayDateKey()}.
 *
 * Controlled: `value` + `onChange(key | null)`; use react-hook-form's <Controller>.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  invalid = false,
  showToday = false,
  id,
  className,
  'aria-describedby': describedBy,
  ...props
}) {
  const today = todayDateKey();
  const todayAllowed = (!min || today >= min) && (!max || today <= max);
  const readableId = id ? `${id}-readable` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <input
            id={id}
            type="date"
            value={value ?? ''}
            min={min}
            max={max}
            onChange={(event) => onChange?.(event.target.value || null)}
            aria-describedby={[describedBy, readableId].filter(Boolean).join(' ') || undefined}
            className={fieldClasses(invalid)}
            {...props}
          />
        </div>
        {showToday && (
          <button
            type="button"
            onClick={() => onChange?.(today)}
            disabled={!todayAllowed || value === today || props.disabled}
            className="min-h-11 shrink-0 rounded-control border-2 border-line-strong bg-surface px-3 font-semibold text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-55"
          >
            Today
          </button>
        )}
      </div>
      {isDateKey(value) && (
        <p id={readableId} className="text-sm text-muted">
          {formatSchoolDate(value, { weekday: true })}
          {value === today && ' (today)'}
        </p>
      )}
    </div>
  );
}

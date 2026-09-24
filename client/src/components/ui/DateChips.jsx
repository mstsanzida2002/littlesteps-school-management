import { Check } from 'lucide-react';
import { useId } from 'react';

import { cn } from '../../utils/cn.js';
import { dayChipLabel } from '../../utils/schoolDays.js';

/**
 * One-tap day picker: a row of chips ("Today", "Wed 23 Sep", …), scrolling sideways on phones.
 * A radio group underneath (arrow keys move, one tab stop), so it is as accessible as a select.
 * The selected chip is filled Charleston with a check mark (not colour alone).
 *
 *   <DateChips label="Day" days={markableSchoolDays(...)} today={today} value={date} onChange={setDate} />
 */
export function DateChips({ label, days, today, value, onChange, className }) {
  const name = useId();
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="mb-1.5 font-semibold">{label}</legend>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {days.map((day) => {
          const selected = day === value;
          return (
            <label
              key={day}
              className={cn(
                'relative flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-2 px-4 font-semibold whitespace-nowrap transition-colors',
                'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                selected
                  ? 'border-brand-800 bg-brand-800 text-white'
                  : 'border-line-strong bg-surface text-sand-700 hover:border-brand-300 hover:text-ink',
              )}
            >
              <input
                type="radio"
                name={name}
                value={day}
                checked={selected}
                onChange={() => onChange(day)}
                className="sr-only"
              />
              {selected && <Check aria-hidden="true" className="size-4" />}
              <time dateTime={day}>{dayChipLabel(day, today)}</time>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

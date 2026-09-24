import { CircleAlert } from 'lucide-react';
import { useId } from 'react';

import { cn } from '../../utils/cn.js';
import { TONE_SOFT } from './tones.js';

/**
 * Radio buttons in a fieldset. Controlled: `value` + `onChange(value)` (use react-hook-form's
 * <Controller> in forms). Options: [{ value, label, description?, icon?, tone? }].
 *
 * variant:
 * - "list": stacked rows;
 * - "segmented": one row of large buttons with icons — e.g. marking attendance quickly. The
 *   checked option takes its status tone (never colour alone: icon and label stay visible).
 */
export function RadioGroup({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  hint,
  variant = 'list',
  legendHidden = false,
  disabled = false,
  className,
}) {
  const baseId = useId();
  const groupName = name ?? baseId;
  const hintId = hint ? `${baseId}-hint` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const segmented = variant === 'segmented';

  return (
    <fieldset
      className={cn('min-w-0', className)}
      aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend className={cn('mb-1.5 font-semibold', legendHidden && 'sr-only')}>{legend}</legend>
      {hint && (
        <p id={hintId} className="-mt-1 mb-2 text-sm text-muted">
          {hint}
        </p>
      )}
      <div className={cn(segmented ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1')}>
        {options.map((option) => {
          const Icon = option.icon;
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55',
                segmented
                  ? cn(
                      'flex-1 justify-center border-2 px-3 font-semibold transition-colors',
                      checked
                        ? cn('border-current', TONE_SOFT[option.tone ?? 'info'])
                        : 'border-line-strong bg-surface text-sand-700 hover:border-sand-300',
                    )
                  : 'px-1',
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={checked}
                onChange={() => onChange?.(option.value)}
                className={cn('size-5 shrink-0 accent-brand-800', segmented && 'sr-only')}
              />
              {Icon && <Icon className="size-5 shrink-0" />}
              <span className="leading-snug">
                {option.label}
                {option.description && (
                  <span className="block text-sm font-normal text-muted">{option.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p
          id={errorId}
          className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-absent-ink"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </fieldset>
  );
}

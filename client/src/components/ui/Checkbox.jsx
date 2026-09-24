import { CircleAlert } from 'lucide-react';
import { useId } from 'react';

import { cn } from '../../utils/cn.js';

/**
 * Native checkbox with its label; the whole row (44px tall) is the touch target.
 * `error` is shown under it and announced with the checkbox (aria-describedby).
 */
export function Checkbox({ label, description, error, invalid = false, id, className, ...props }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const isInvalid = invalid || Boolean(error);
  return (
    <div className={className}>
      <div className="flex min-h-11 items-start gap-3 py-2.5">
        <input
          id={inputId}
          type="checkbox"
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={isInvalid || undefined}
          className={cn(
            'mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-brand-800 disabled:cursor-not-allowed',
            isInvalid && 'outline-2 outline-cerise-600',
          )}
          {...props}
        />
        <label htmlFor={inputId} className="cursor-pointer leading-snug">
          <span className="font-medium">{label}</span>
          {description && (
            <span id={descriptionId} className="block text-sm text-muted">
              {description}
            </span>
          )}
        </label>
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-semibold text-absent-ink">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

import { CircleAlert } from 'lucide-react';
import { cloneElement, isValidElement, useId } from 'react';

import { cn } from '../../utils/cn.js';

/**
 * Label + control + hint + error. Wires the single child control: id, aria-describedby (hint and
 * error), aria-invalid, aria-required and, for our own components, `invalid`.
 *
 *   <FormField label="New password" hint="At least 8 characters" error={errors.newPassword?.message}>
 *     <PasswordInput autoComplete="new-password" {...register('newPassword')} />
 *   </FormField>
 */
export function FormField({
  label,
  hint,
  error,
  required = false,
  optional = false,
  id,
  className,
  children,
}) {
  const autoId = useId();
  const controlId = id ?? (isValidElement(children) ? children.props.id : undefined) ?? autoId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  let control = children;
  if (isValidElement(children)) {
    const describedBy =
      [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
    control = cloneElement(children, {
      id: controlId,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : undefined,
      'aria-required': required || undefined,
      // Only our components understand `invalid`; DOM elements get aria-invalid only.
      ...(typeof children.type !== 'string' && {
        invalid: Boolean(error) || children.props.invalid,
      }),
    });
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="font-semibold text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="text-cerise-700">
            {' '}
            *
          </span>
        )}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-semibold text-absent-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

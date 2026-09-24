import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { cn } from '../../utils/cn.js';
import { fieldClasses } from './fieldStyles.js';

/**
 * Text input. Use inside <FormField>, which wires the label, hint and error (id,
 * aria-describedby, aria-invalid, `invalid`). Works with react-hook-form's register().
 */
export function Input({ invalid = false, icon: Icon, className, type = 'text', ...props }) {
  if (!Icon) return <input type={type} className={fieldClasses(invalid, className)} {...props} />;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-sand-500" />
      <input type={type} className={fieldClasses(invalid, cn('pl-11', className))} {...props} />
    </div>
  );
}

/** Password input with a show/hide toggle (44px, keeps focus in the field). */
export function PasswordInput({ invalid = false, className, ...props }) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Hide password' : 'Show password';
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={fieldClasses(invalid, cn('pr-12', className))}
        {...props}
      />
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 place-items-center rounded-control text-sand-600 hover:text-brand-800"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

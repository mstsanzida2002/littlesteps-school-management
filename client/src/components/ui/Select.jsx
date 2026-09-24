import { ChevronDown } from 'lucide-react';

import { cn } from '../../utils/cn.js';
import { fieldClasses } from './fieldStyles.js';

/**
 * Native select (the phone's own picker is the fastest on mobile). Pass `options`
 * ([{ value, label, disabled? }]) or <option> children. `placeholder` adds an empty first option.
 */
export function Select({ invalid = false, options, placeholder, className, children, ...props }) {
  return (
    <div className="relative">
      <select className={fieldClasses(invalid, cn('appearance-none pr-11', className))} {...props}>
        {placeholder != null && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-sand-600" />
    </div>
  );
}

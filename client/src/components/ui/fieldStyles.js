import { cn } from '../../utils/cn.js';

/** Shared look of text-like controls (Input, Textarea, Select, DatePicker). */
export const fieldClasses = (invalid, className) =>
  cn(
    'block w-full min-h-11 rounded-control border-2 bg-surface px-3.5 py-2 text-base text-ink',
    'placeholder:text-sand-500 transition-colors',
    'hover:border-sand-300 focus:border-brand-700 focus-visible:outline-brand-500 focus-visible:outline-offset-0',
    'disabled:cursor-not-allowed disabled:bg-sand-50 disabled:text-sand-500',
    invalid
      ? 'border-cerise-600 hover:border-cerise-600 focus:border-cerise-600'
      : 'border-line-strong',
    className,
  );

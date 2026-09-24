import { cn } from '../../utils/cn.js';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap select-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55';

const VARIANTS = {
  primary: 'bg-brand-800 text-white hover:bg-brand-700 active:bg-brand-900',
  secondary:
    'border-2 border-line-strong bg-surface text-brand-800 hover:border-brand-300 hover:bg-brand-50',
  ghost: 'text-brand-700 hover:bg-brand-50 active:bg-brand-100',
  danger: 'bg-cerise-700 text-white hover:bg-cerise-800',
  'danger-ghost': 'text-cerise-700 hover:bg-cerise-50 active:bg-cerise-100',
};

// sm stays 44px tall on touch screens (pointer-coarse); icon buttons are always 44px.
const SIZES = {
  sm: 'min-h-9 px-3 text-sm pointer-coarse:min-h-11',
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-12 px-6 text-lg',
  icon: 'size-11 shrink-0',
};

/** Class names for a button-looking element (also for <Link> styled as a button). */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
} = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className);
}

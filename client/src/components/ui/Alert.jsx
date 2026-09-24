import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

import { cn } from '../../utils/cn.js';

const TONES = {
  info: { icon: Info, classes: 'border-brand-200 bg-brand-50 text-brand-800' },
  success: { icon: CircleCheck, classes: 'border-citron-200 bg-present-soft text-present-ink' },
  warning: { icon: TriangleAlert, classes: 'border-late/30 bg-late-soft text-late-ink' },
  error: { icon: CircleAlert, classes: 'border-cerise-200 bg-absent-soft text-absent-ink' },
};

/**
 * Inline message with an icon. Errors are announced (role="alert"); other tones are polite
 * (role="status"). Success uses the citron tones — never Cerise.
 */
export function Alert({ tone = 'info', title, action, className, children }) {
  const { icon: Icon, classes } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-control border px-4 py-3', classes, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn(title ? 'mt-0.5' : 'font-semibold')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

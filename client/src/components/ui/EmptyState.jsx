import { Inbox } from 'lucide-react';

import { cn } from '../../utils/cn.js';

/** Nothing to show yet: say why and, when possible, what to do next (`action`). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-10',
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <div className="max-w-sm">
        <p className="text-lg font-bold text-ink">{title}</p>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

import { CircleAlert, Lock, RotateCcw, SearchX, WifiOff } from 'lucide-react';

import { friendlyError } from '../../lib/errorMessages.js';
import { cn } from '../../utils/cn.js';
import { Button } from './Button.jsx';

const ICONS = { 0: WifiOff, 403: Lock, 404: SearchX };

/** A failed load, in the words of lib/errorMessages.js, with a retry button (e.g. refetch). */
export function ErrorState({
  error,
  title,
  onRetry,
  retrying = false,
  compact = false,
  className,
}) {
  const info = friendlyError(error);
  const Icon = ICONS[error?.status] ?? CircleAlert;
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-10',
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-absent-soft text-absent-ink">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <div className="max-w-sm">
        <p className="text-lg font-bold text-ink">{title ?? info.title}</p>
        <p className="mt-1 text-muted">{info.message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" icon={RotateCcw} onClick={onRetry} loading={retrying}>
          Try again
        </Button>
      )}
    </div>
  );
}

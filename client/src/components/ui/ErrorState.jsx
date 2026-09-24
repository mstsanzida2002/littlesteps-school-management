import { CircleAlert, Lock, RotateCcw, SearchX, WifiOff } from 'lucide-react';

import { cn } from '../../utils/cn.js';
import { Button } from './Button.jsx';

/** Words for an ApiClientError, by status (status 0 = no connection). */
function describe(error) {
  switch (error?.status) {
    case 0:
      return {
        icon: WifiOff,
        title: 'No connection',
        text: 'We could not reach LittleSteps. Check your internet connection and try again.',
      };
    case 403:
      return { icon: Lock, title: 'Not available to you', text: error.message };
    case 404:
      return { icon: SearchX, title: 'Not found', text: error.message };
    case 503:
      return {
        icon: CircleAlert,
        title: 'Temporarily unavailable',
        text: 'The service is busy for a moment. Please try again shortly.',
      };
    default:
      return {
        icon: CircleAlert,
        title: 'Something went wrong',
        text: error?.message || 'Please try again.',
      };
  }
}

/** A failed load, with a retry button (e.g. refetch from TanStack Query). */
export function ErrorState({
  error,
  title,
  onRetry,
  retrying = false,
  compact = false,
  className,
}) {
  const info = describe(error);
  const Icon = info.icon;
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
        <p className="mt-1 text-muted">{info.text}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" icon={RotateCcw} onClick={onRetry} loading={retrying}>
          Try again
        </Button>
      )}
    </div>
  );
}

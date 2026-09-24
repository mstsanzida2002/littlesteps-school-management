import { Bell } from 'lucide-react';
import { Link } from 'react-router';

import { cn } from '../../utils/cn.js';

const unreadLabel = (count) =>
  count ? `${count} unread notification${count === 1 ? '' : 's'}` : 'No unread notifications';

/**
 * Bell with the unread count. Presentational: the connected version
 * (features/notifications/components/NotificationBell.jsx) supplies `count` from
 * useUnreadCount. A link when `to` is given, a button with `onClick`, otherwise a labelled image.
 */
export function NotificationBell({ count = 0, to, onClick, className }) {
  const label = unreadLabel(count);
  const content = (
    <>
      <Bell aria-hidden="true" className="size-6" />
      {count > 0 && (
        <span
          data-testid="unread-count"
          aria-hidden="true"
          className="absolute top-1 right-0.5 min-w-5 rounded-full bg-cerise-700 px-1 text-center text-xs leading-5 font-bold text-white ring-2 ring-surface"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </>
  );
  const classes = cn(
    'relative grid size-11 shrink-0 place-items-center rounded-control text-brand-800',
    (to || onClick) && 'hover:bg-brand-50',
    className,
  );

  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} className={classes}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={label} title={label} className={classes}>
        {content}
      </button>
    );
  }
  return (
    <span role="img" aria-label={label} title={label} className={classes}>
      {content}
    </span>
  );
}

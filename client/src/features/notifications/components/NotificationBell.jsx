import { useUnreadCount } from '../hooks/useUnreadCount.js';

/** Bell with the unread count (the notification list page comes with the student module). */
export function NotificationBell() {
  const { data: count = 0 } = useUnreadCount();
  const label = count
    ? `${count} unread notification${count === 1 ? '' : 's'}`
    : 'No unread notifications';

  return (
    <span
      className="relative inline-flex rounded-lg p-2 text-slate-600"
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path
          d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && (
        <span
          data-testid="unread-count"
          className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-absent px-1.5 text-center text-xs leading-5 font-bold text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </span>
  );
}

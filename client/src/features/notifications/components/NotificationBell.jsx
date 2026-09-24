import { NotificationBell as BellView } from '../../../components/ui/NotificationBell.jsx';
import { useUnreadCount } from '../hooks/useUnreadCount.js';

/**
 * The bell with the live unread count (socket pushes, 60 s polling while disconnected).
 * The notification list page comes with the student module; until then it is not a link.
 */
export function NotificationBell(props) {
  const { data: count = 0 } = useUnreadCount();
  return <BellView count={count} {...props} />;
}

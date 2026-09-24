/**
 * Which cached data a pushed notification makes stale. The server has no separate "data changed"
 * events: a notification is the signal that something the user can see has changed, so each
 * type refreshes the matching query roots (and every dashboard).
 */
const BY_TYPE = {
  absence: [['attendance']],
  attendance_corrected: [['attendance']],
  low_attendance: [['attendance']],
  result_published: [['results']],
  result_updated: [['results']],
  meeting_invite: [['meetings']],
  meeting_updated: [['meetings']],
  meeting_cancelled: [['meetings']],
  notice: [['notices']],
};

/** Query keys to invalidate for a notification (by its `type`). */
export function keysForNotification(notification) {
  return [...(BY_TYPE[notification?.type] ?? []), ['dashboard']];
}

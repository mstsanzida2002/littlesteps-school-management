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

/**
 * "data:changed" (a refresh signal, no notification): scope → the query roots to refetch.
 * Payloads carry ids only (classId, sectionId, assessmentId, meetingId, dates).
 */
const BY_SCOPE = {
  attendance: [['attendance']],
  results: [['results']],
  users: [['users'], ['attendance'], ['meetings']],
  registrations: [['users']],
  structure: [['structure'], ['school'], ['users']],
  assignments: [['assignments'], ['school'], ['attendance', 'today']],
  settings: [['settings'], ['school']],
  meetings: [['meetings']],
  notices: [['notices']],
};

/** Query keys to invalidate for a "data:changed" payload (and every dashboard). */
export function keysForDataChange(change) {
  return [...(BY_SCOPE[change?.scope] ?? []), ['dashboard']];
}

/** How meeting fields are shown (server enums in models/meeting). */
export const MEETING_TYPES = Object.freeze([
  { value: 'parent_teacher', label: 'Parent-teacher meeting' },
  { value: 'orientation', label: 'Orientation' },
  { value: 'event', label: 'School event' },
  { value: 'other', label: 'Other' },
]);

export const meetingTypeLabel = (value) =>
  MEETING_TYPES.find((t) => t.value === value)?.label ?? value;

/** 'cancelled' | 'past' | 'upcoming' — for <StatusBadge group="meeting" /> */
export function meetingState(meeting, now = Date.now()) {
  if (meeting.status === 'cancelled' || meeting.cancelledAt) return 'cancelled';
  const end = new Date(meeting.dateTime).getTime() + (meeting.durationMinutes ?? 0) * 60_000;
  return meeting.isPast || end < now ? 'past' : 'upcoming';
}

export const DURATIONS = Object.freeze([15, 20, 30, 45, 60, 90, 120]);

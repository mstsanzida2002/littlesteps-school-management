/** Icon and colours per notification type (the list page, the guardian's home page). */
import {
  Award,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleAlert,
  Megaphone,
  PencilLine,
  TriangleAlert,
} from 'lucide-react';

export const NOTIFICATION_ICONS = {
  absence: { icon: CircleAlert, className: 'bg-absent-soft text-absent-ink' },
  attendance_corrected: { icon: CalendarCheck, className: 'bg-present-soft text-present-ink' },
  low_attendance: { icon: TriangleAlert, className: 'bg-late-soft text-late-ink' },
  result_published: { icon: Award, className: 'bg-info-soft text-info-ink' },
  result_updated: { icon: PencilLine, className: 'bg-info-soft text-info-ink' },
  meeting_invite: { icon: CalendarClock, className: 'bg-info-soft text-info-ink' },
  meeting_updated: { icon: CalendarClock, className: 'bg-late-soft text-late-ink' },
  meeting_cancelled: { icon: CalendarX, className: 'bg-absent-soft text-absent-ink' },
  notice: { icon: Megaphone, className: 'bg-blush-100 text-cerise-800' },
};

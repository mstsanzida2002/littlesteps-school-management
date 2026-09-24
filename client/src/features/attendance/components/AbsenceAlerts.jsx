import { ChevronRight, CircleCheck, CircleX } from 'lucide-react';
import { Link } from 'react-router';

import { studentPaths } from '../../../config/paths.js';
import { cn } from '../../../utils/cn.js';
import { formatSchoolDate } from '../../../utils/date.js';
import { text } from '../text/index.js';

/**
 * The latest absence alerts for a guardian (absence notifications, one per school day), in plain
 * words: "Ayaan was absent on Wed, 23 Sep" + the subjects missed. A corrected day says so. Each
 * opens that day on the attendance calendar.
 */
export function AbsenceAlerts({ name, alerts }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {alerts.map((alert) => {
        const date = alert.data?.date;
        const when = date ? formatSchoolDate(date, { weekday: true, year: false }) : '';
        const corrected = alert.data?.corrected;
        const subjects = (alert.data?.subjects ?? []).map((s) => s.subject).join(', ');
        const Icon = corrected ? CircleCheck : CircleX;
        return (
          <li key={alert._id}>
            <Link
              to={studentPaths.attendance({ day: date })}
              className="flex min-h-14 items-center gap-3 py-2.5 hover:bg-blush-50"
            >
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-full',
                  corrected ? 'bg-present-soft text-present-ink' : 'bg-absent-soft text-absent-ink',
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">
                  {corrected ? text.alert.corrected(name, when) : text.alert.absent(name, when)}
                </span>
                {!corrected && subjects && (
                  <span className="block text-sm text-muted">{text.alert.subjects(subjects)}</span>
                )}
              </span>
              {!alert.isRead && (
                <span
                  className="size-2.5 shrink-0 rounded-full bg-cerise-500"
                  role="img"
                  aria-label={text.alert.unread}
                />
              )}
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-sand-400" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

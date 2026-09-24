import { CalendarCheck, ChartColumn, ClipboardList } from 'lucide-react';
import { NavLink } from 'react-router';

import { teacherPaths } from '../../../config/paths.js';
import { cn } from '../../../utils/cn.js';

/**
 * Sub-navigation of the attendance area (take / records / summary). Keeps the chosen
 * class-section (and day) when switching.
 */
export function AttendanceNav({ classId, sectionId, date }) {
  const links = [
    {
      label: 'Take',
      icon: CalendarCheck,
      to: teacherPaths.takeAttendance({ classId, sectionId, date }),
      end: true,
    },
    {
      label: 'Records',
      icon: ClipboardList,
      to: teacherPaths.attendanceRecords({ classId, sectionId, date }),
    },
    {
      label: 'Summary',
      icon: ChartColumn,
      to: teacherPaths.attendanceSummary({ classId, sectionId }),
    },
  ];
  return (
    <nav aria-label="Attendance" className="mb-5">
      <ul className="flex gap-1 rounded-control bg-sand-100 p-1">
        {links.map(({ label, icon: Icon, to, end }) => (
          <li key={label} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center justify-center gap-2 rounded-[0.6rem] px-2 font-semibold transition-colors',
                  isActive
                    ? 'bg-surface text-brand-800 shadow-card'
                    : 'text-sand-700 hover:text-ink',
                )
              }
            >
              <Icon aria-hidden="true" className="hidden size-5 sm:block" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

import { STATUS_GROUPS } from '../../../config/statuses.js';

/** A result's attendance: present, absent or excused (no "late" for assessments). */
export const RESULT_ATTENDANCE_OPTIONS = ['present', 'absent', 'excused'].map((value) => ({
  value,
  label: STATUS_GROUPS.attendance[value].label,
  icon: STATUS_GROUPS.attendance[value].icon,
  tone: STATUS_GROUPS.attendance[value].tone,
}));

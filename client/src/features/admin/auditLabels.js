/**
 * Audit log entries in words (FR-ADM-11). Every action the server records (services/*.js
 * recordAudit calls) has a label; unknown ones are humanised so a new action still reads well.
 */
export const ACTION_LABELS = Object.freeze({
  'user.create': 'Created an account',
  'user.update': 'Edited an account',
  'user.suspend': 'Suspended an account',
  'user.reactivate': 'Reactivated an account',
  'user.delete': 'Deleted an account',
  'user.approve': 'Approved a registration',
  'user.reject': 'Rejected a registration',
  'user.register': 'Registered (waiting for approval)',
  'user.password_change': 'Changed their password',
  'user.password_reset': 'Reset a password',
  'class.create': 'Added a class',
  'class.update': 'Edited a class',
  'class.delete': 'Deleted a class',
  'section.create': 'Added a section',
  'section.update': 'Edited a section',
  'section.delete': 'Deleted a section',
  'subject.create': 'Added a subject',
  'subject.update': 'Edited a subject',
  'subject.delete': 'Deleted a subject',
  'session.create': 'Added a school year',
  'session.update': 'Edited a school year',
  'session.delete': 'Deleted a school year',
  'session.activate': 'Switched the active school year',
  'assignment.create': 'Assigned a teacher',
  'assignment.update': 'Changed a timetable',
  'assignment.end': 'Ended an assignment',
  'assignment.delete': 'Removed an assignment',
  'settings.update': 'Changed the settings',
  'attendance.mark': 'Took attendance',
  'attendance.update': 'Corrected attendance',
  'attendance.override': 'Overrode attendance (admin)',
  'assessment.create': 'Created an assessment',
  'assessment.update': 'Edited an assessment',
  'assessment.delete': 'Deleted an assessment',
  'assessment.publish': 'Published results',
  'results.save_draft': 'Saved draft results',
  'result.update': 'Changed a published result',
  'result.override': 'Overrode a published result (admin)',
  'meeting.create': 'Created a meeting',
  'meeting.update': 'Edited a meeting',
  'meeting.cancel': 'Cancelled a meeting',
  'notice.create': 'Saved a notice draft',
  'notice.update': 'Edited a notice',
  'notice.publish': 'Published a notice',
  'notice.expire': 'Expired a notice',
  'notice.delete': 'Deleted a notice',
});

export const ENTITY_TYPES = Object.freeze([
  'User',
  'Class',
  'Section',
  'Subject',
  'AcademicSession',
  'TeacherAssignment',
  'Settings',
  'Attendance',
  'Assessment',
  'Result',
  'Meeting',
  'Notice',
]);

const ENTITY_LABELS = { AcademicSession: 'School year', TeacherAssignment: 'Assignment' };
export const entityLabel = (type) => ENTITY_LABELS[type] ?? type;

const humanize = (value) =>
  String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .replace(/[._]+/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

export const actionLabel = (action) => ACTION_LABELS[action] ?? humanize(action);

/** Overrides and critical changes stand out in the log. */
export const isCritical = (action) =>
  /override|suspend|delete|reject|activate|password_reset/.test(action ?? '');

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** A value inline within a line: scalars as-is, a nested object flattened to "key: value, …". */
const formatScalar = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'string' && ISO_DATE_TIME.test(value)) return value.slice(0, 10);
  if (Array.isArray(value)) return value.length ? value.map(formatScalar).join(', ') : '—';
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([key]) => !/Id$/.test(key));
    return entries.length
      ? entries.map(([key, v]) => `${humanize(key)}: ${formatScalar(v)}`).join(', ')
      : '—';
  }
  return String(value);
};

/**
 * A change value as readable text: scalars as-is, arrays joined, and objects as one "Field:
 * value" line per key — dropping id references (userId, classId…), which are opaque database
 * ids an admin can't act on.
 */
function formatValue(value) {
  if (value === undefined || value === null) return '—';
  if (Array.isArray(value)) return value.length ? value.map(formatScalar).join(', ') : '—';
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([key]) => !/Id$/.test(key));
    return entries.length
      ? entries.map(([key, v]) => `${humanize(key)}: ${formatScalar(v)}`).join('\n')
      : '—';
  }
  return formatScalar(value);
}

/**
 * A readable before/after table: [{ field, before, after }] for every key present in either.
 */
export function changeRows(before = {}, after = {}) {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return fields.map((field) => ({
    field: humanize(field.replace(/Id$/, '')),
    before: formatValue(before?.[field]),
    after: formatValue(after?.[field]),
  }));
}

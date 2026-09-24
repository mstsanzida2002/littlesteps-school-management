export const ROLES = Object.freeze({
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
});

export const ACCOUNT_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  // Self-registration declined by an admin (FR-ADM-02).
  REJECTED: 'rejected',
});

export const ASSIGNMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  // Kept for history (attendance/assessments exist) but no longer grants access.
  ENDED: 'ended',
});

/** Machine-readable `code` values in error responses (clients branch on these, not messages). */
export const ERROR_CODES = Object.freeze({
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  SESSION_SWITCH_CONFIRMATION_REQUIRED: 'SESSION_SWITCH_CONFIRMATION_REQUIRED',
  SCHEDULE_CLASH: 'SCHEDULE_CLASH',
  IN_USE: 'IN_USE',
  USER_HAS_HISTORY: 'USER_HAS_HISTORY',
  ROLL_NUMBER_TAKEN: 'ROLL_NUMBER_TAKEN',
  LAST_ADMIN: 'LAST_ADMIN',
});

// Single-school deployment. All calendar-date logic goes through utils/date.js.
export const SCHOOL_TIMEZONE = 'Asia/Dhaka';

export const JSON_BODY_LIMIT = '100kb';

/** Index matches Date#getUTCDay() (0 = Sunday). */
export const WEEKDAYS = Object.freeze([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

export const ATTENDANCE_STATUS = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
});

export const GENDERS = Object.freeze(['male', 'female']);

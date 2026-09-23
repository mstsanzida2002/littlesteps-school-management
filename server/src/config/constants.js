export const ROLES = Object.freeze({
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
});

export const ACCOUNT_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
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

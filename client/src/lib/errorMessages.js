/**
 * One friendly message for every API error the UI can meet. Branch on `code` (never on the
 * server's message); fall back to the HTTP status. Used by forms (serverErrors.js), ErrorState
 * and toasts, so the same problem always reads the same way.
 *
 * `message` may be a function of the error (for details such as limitDays).
 * `server: true` keeps the server's own message, which is more specific than anything generic
 * (e.g. "Roll 6 is already taken in Playgroup-B. Next free: 7.").
 */
const CODE_MESSAGES = {
  // Auth and sessions
  PASSWORD_CHANGE_REQUIRED: {
    title: 'Choose a new password',
    message: 'Please choose your own password to continue.',
  },
  NO_SESSION: { title: 'Signed out', message: 'Your session has ended. Please log in again.' },
  TOKEN_ROTATED: { title: 'Signed out', message: 'Your session has ended. Please log in again.' },
  SESSION_INVALID: { title: 'Signed out', message: 'Your session has ended. Please log in again.' },
  DATABASE_UNAVAILABLE: {
    title: 'Temporarily unavailable',
    message: 'LittleSteps is busy for a moment. Please try again shortly.',
  },

  // Admin
  SESSION_SWITCH_CONFIRMATION_REQUIRED: {
    title: 'Confirm the session switch',
    message: 'Switching the active session affects everyone. Confirm to continue.',
  },
  SCHEDULE_CLASH: { title: 'Timetable clash', server: true },
  IN_USE: { title: 'Still in use', server: true },
  USER_HAS_HISTORY: {
    title: 'Has records',
    message: 'This account has school records, so it cannot be deleted. Suspend it instead.',
  },
  ROLL_NUMBER_TAKEN: { title: 'Roll number taken', server: true },
  LAST_ADMIN: {
    title: 'Last administrator',
    message: 'The last active administrator cannot be removed or suspended.',
  },

  // Attendance
  FUTURE_DATE: {
    title: 'Date in the future',
    message: 'Attendance can only be taken for today or earlier.',
  },
  OUTSIDE_SESSION: {
    title: 'Outside the session',
    message: 'That date is outside the current school session.',
  },
  OFF_DAY: {
    title: 'Weekly holiday',
    message: 'That day is a weekly holiday. Choose a school day.',
  },
  BACKDATE_LIMIT: {
    title: 'Too far back',
    message: (error) =>
      `Teachers can change attendance for the last ${error.details?.limitDays ?? 'few'} days only. ` +
      'An administrator can make this change for you.',
  },
  NO_SCHEDULED_SUBJECTS: {
    title: 'Nothing scheduled',
    message:
      'No subjects are scheduled for this class on that day. Choose the subjects you taught.',
  },
  ALREADY_MARKED: {
    title: 'Already taken',
    message: 'Attendance for this class and day was already submitted. View or edit it instead.',
  },

  // Results
  ASSESSMENT_PUBLISHED: {
    title: 'Already published',
    message: 'This assessment is published. Change a result with Edit and give a reason.',
  },
  RESULTS_INCOMPLETE: {
    title: 'Some results are missing',
    message: 'Every student needs a complete entry before the results can be published.',
  },

  // Meetings
  MEETING_STARTED: {
    title: 'Meeting started',
    message: 'This meeting has already started, so it can no longer be changed.',
  },
  MEETING_CANCELLED: { title: 'Meeting cancelled', message: 'This meeting was cancelled.' },
};

const STATUS_MESSAGES = {
  0: {
    title: 'No connection',
    message: 'We could not reach LittleSteps. Check your internet connection and try again.',
  },
  // Login failures are 401s too ("Invalid username/email or password"): keep the server's words.
  401: { title: 'Not signed in', server: true },
  403: { title: 'Not available to you', server: true },
  404: { title: 'Not found', server: true },
  409: { title: 'Changed elsewhere', server: true },
  413: { title: 'Too large', message: 'That is too much to send at once.' },
  422: { title: 'Check the details', server: true },
  429: {
    title: 'Too many attempts',
    message: 'Too many requests in a short time. Please wait a few minutes and try again.',
  },
  503: {
    title: 'Temporarily unavailable',
    message: 'LittleSteps is busy for a moment. Please try again shortly.',
  },
};

const FALLBACK = {
  title: 'Something went wrong',
  message: 'Something went wrong. Please try again.',
};
const GENERIC_SERVER_MESSAGES = new Set(['Validation failed', 'Internal server error']);

/** Codes the UI knows (the unit test checks this against the server's ERROR_CODES). */
export const KNOWN_ERROR_CODES = Object.freeze(Object.keys(CODE_MESSAGES));

/** → { title, message, code, status } for any thrown value. */
export function friendlyError(error) {
  const status = error?.status;
  const entry =
    CODE_MESSAGES[error?.code] ??
    STATUS_MESSAGES[status] ??
    (status >= 500
      ? { title: 'Server problem', message: 'Something went wrong on our side. Please try again.' }
      : null) ??
    FALLBACK;
  const serverMessage =
    error?.message && !GENERIC_SERVER_MESSAGES.has(error.message) ? error.message : null;
  return {
    title: entry.title,
    message: entry.server
      ? (serverMessage ?? FALLBACK.message)
      : typeof entry.message === 'function'
        ? entry.message(error)
        : entry.message,
    code: error?.code,
    status,
  };
}

/** Just the sentence, for toasts and inline alerts. */
export const errorMessage = (error) => friendlyError(error).message;

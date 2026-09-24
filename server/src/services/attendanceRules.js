/**
 * Attendance rules shared by marking, editing and summaries (SRS 3.6, CLAUDE.md
 * "Attendance feature rules"). All date logic goes through utils/date.js.
 */
import { ASSIGNMENT_STATUS, ATTENDANCE_STATUS, ERROR_CODES, ROLES } from '../config/constants.js';
import { StudentProfile, TeacherAssignment } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import {
  daysBetween,
  formatSchoolDateLong,
  todaySchoolDate,
  toSchoolDate,
  weekdayOf,
} from '../utils/date.js';

/** A student needs at least this many recorded school days before a low-attendance warning. */
export const MIN_RECORDED_DAYS_FOR_WARNING = 5;
/** Guardian emails are skipped for markings/edits of dates older than this many days. */
export const EMAIL_MAX_AGE_DAYS = 1;

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Attendance % = attended ÷ recorded × 100, attended = present (+ late when lateCountsAsPresent).
 * Only recorded classes count; zero recorded classes → percent null (never divide by zero).
 */
export function attendanceRate({ total = 0, present = 0, late = 0 }, lateCountsAsPresent) {
  const attended = present + (lateCountsAsPresent ? late : 0);
  return {
    attended,
    percent: total > 0 ? Math.round((attended / total) * 1000) / 10 : null,
  };
}

/** Aggregation accumulators counting statuses (for $group). */
export const statusCounters = {
  total: { $sum: 1 },
  present: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
  absent: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ABSENT] }, 1, 0] } },
  late: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.LATE] }, 1, 0] } },
};

/** Teachers may only work on dates within Settings.attendanceBackdateDays of today; admins anywhere. */
export function assertWithinBackdateLimit({ date, settings, actor }) {
  if (actor.role === ROLES.ADMIN) return;
  const age = daysBetween(date, todaySchoolDate());
  if (age > settings.attendanceBackdateDays) {
    throw ApiError.unprocessable(
      `Teachers can only mark or edit attendance for the last ${settings.attendanceBackdateDays} ` +
        `days. For ${formatSchoolDateLong(date)}, please ask an admin to make the change.`,
      undefined,
      { code: ERROR_CODES.BACKDATE_LIMIT, details: { limitDays: settings.attendanceBackdateDays } },
    );
  }
}

/** Date rules for marking: not in the future, inside the active session, not a weekly off day. */
export function assertMarkableDate({ dateKey, activeSession, settings, actor }) {
  const date = toSchoolDate(dateKey);
  const today = todaySchoolDate();
  if (date > today) {
    throw ApiError.unprocessable(
      `Attendance cannot be marked for a future date (today is ${formatSchoolDateLong(today)}).`,
      undefined,
      { code: ERROR_CODES.FUTURE_DATE },
    );
  }
  if (date < activeSession.startDate || date > activeSession.endDate) {
    throw ApiError.unprocessable(
      `${formatSchoolDateLong(date)} is outside the active session ${activeSession.name}.`,
      undefined,
      { code: ERROR_CODES.OUTSIDE_SESSION },
    );
  }
  const weekday = weekdayOf(date);
  if (settings.weeklyOffDays.includes(weekday)) {
    throw ApiError.unprocessable(`${capitalize(weekday)} is a weekly off day.`, undefined, {
      code: ERROR_CODES.OFF_DAY,
    });
  }
  assertWithinBackdateLimit({ date, settings, actor });
  return date;
}

/** Students enrolled in the class-section for the session and admitted on or before `date`. */
export function enrolledStudents({ classId, sectionId, sessionId, date }, { session } = {}) {
  return StudentProfile.find({ classId, sectionId, sessionId, admissionDate: { $lte: date } })
    .populate('userId', 'name username')
    .sort({ rollNo: 1 })
    .session(session ?? null)
    .lean();
}

/**
 * The subjects a teacher marks for a class-section on a date:
 *  - with `subjectIds`: exactly those, each from the teacher's own active assignments (403 otherwise)
 *    — for unscheduled classes and substitutions (timetableOverride: true);
 *  - otherwise: the teacher's subjects scheduled on that weekday (422 NO_SCHEDULED_SUBJECTS if none).
 * Returns { subjects: [{ _id, name, code }], timetableOverride, scheduledSubjectIds }.
 */
export async function subjectsToMark({
  teacherId,
  classId,
  sectionId,
  sessionId,
  date,
  subjectIds,
  label,
}) {
  const assignments = await TeacherAssignment.find({
    teacherId,
    classId,
    sectionId,
    sessionId,
    status: ASSIGNMENT_STATUS.ACTIVE,
  })
    .populate('subjectId', 'name code')
    .lean();
  if (!assignments.length) throw ApiError.forbidden(`You are not assigned to ${label}.`);

  const weekday = weekdayOf(date);
  const firstSlot = (a) =>
    a.schedule
      .filter((s) => s.day === weekday)
      .map((s) => s.startTime)
      .sort()[0];
  const scheduled = assignments
    .filter((a) => firstSlot(a))
    .sort((a, b) => firstSlot(a).localeCompare(firstSlot(b)));
  const scheduledSubjectIds = scheduled.map((a) => String(a.subjectId._id));

  if (subjectIds?.length) {
    const own = new Map(assignments.map((a) => [String(a.subjectId._id), a.subjectId]));
    const notOwn = subjectIds.filter((id) => !own.has(String(id)));
    if (notOwn.length) {
      throw ApiError.forbidden(`You can only mark subjects you teach in ${label}.`, {
        details: { subjectIds: notOwn },
      });
    }
    return {
      subjects: [...new Set(subjectIds.map(String))].map((id) => own.get(id)),
      timetableOverride: true,
      scheduledSubjectIds,
    };
  }

  if (!scheduled.length) {
    throw ApiError.unprocessable(
      `You have no subjects scheduled for ${label} on ${capitalize(weekday)}. ` +
        'If you taught this class outside the timetable (or are covering a class), choose the ' +
        'subjects manually by sending subjectIds.',
      undefined,
      {
        code: ERROR_CODES.NO_SCHEDULED_SUBJECTS,
        details: { availableSubjects: assignments.map((a) => a.subjectId) },
      },
    );
  }
  return {
    subjects: scheduled.map((a) => a.subjectId),
    timetableOverride: false,
    scheduledSubjectIds,
  };
}

/** Guardian emails only for recent dates (today or yesterday). */
export const emailAllowedFor = (date) => daysBetween(date, todaySchoolDate()) <= EMAIL_MAX_AGE_DAYS;

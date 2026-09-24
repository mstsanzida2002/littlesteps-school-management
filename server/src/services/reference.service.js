/**
 * "Is this still used?" checks that block deletes with a clear 409 (code IN_USE).
 */
import { ERROR_CODES, ROLES } from '../config/constants.js';
import {
  Assessment,
  Attendance,
  AttendanceEditLog,
  Meeting,
  Notice,
  Result,
  Section,
  StudentProfile,
  TeacherAssignment,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

const LABELS = {
  sections: ['section', 'sections'],
  students: ['student', 'students'],
  assignments: ['teacher assignment', 'teacher assignments'],
  attendance: ['attendance record', 'attendance records'],
  assessments: ['assessment', 'assessments'],
  meetings: ['meeting', 'meetings'],
  results: ['result', 'results'],
  editLogs: ['attendance correction', 'attendance corrections'],
  notices: ['notice', 'notices'],
};

/**
 * Records that make a user "have history" (hard delete is refused; suspend instead).
 * AuditLog entries never count: they keep the id so the trail survives deletion.
 */
export async function countUserHistory(user) {
  const id = user._id;
  const byRole = {
    [ROLES.STUDENT]: {
      attendance: Attendance.countDocuments({ studentId: id }),
      results: Result.countDocuments({ studentId: id }),
      editLogs: AttendanceEditLog.countDocuments({ studentId: id }),
      meetings: Meeting.countDocuments({
        $or: [
          { inviteeStudentIds: id },
          { 'invite.studentIds': id },
          { 'responses.studentId': id },
        ],
      }),
    },
    [ROLES.TEACHER]: {
      assignments: TeacherAssignment.countDocuments({ teacherId: id }),
      attendance: Attendance.countDocuments({ teacherId: id }),
      assessments: Assessment.countDocuments({ createdBy: id }),
      results: Result.countDocuments({ updatedBy: id }),
      editLogs: AttendanceEditLog.countDocuments({ editedBy: id }),
      meetings: Meeting.countDocuments({ $or: [{ organizerId: id }, { inviteeTeacherIds: id }] }),
      notices: Notice.countDocuments({ publishedBy: id }),
    },
    [ROLES.ADMIN]: {
      results: Result.countDocuments({ updatedBy: id }),
      editLogs: AttendanceEditLog.countDocuments({ editedBy: id }),
      meetings: Meeting.countDocuments({ organizerId: id }),
      notices: Notice.countDocuments({ publishedBy: id }),
    },
  }[user.role];

  const entries = await Promise.all(
    Object.entries(byRole).map(async ([key, promise]) => [key, await promise]),
  );
  return Object.fromEntries(entries.filter(([, count]) => count > 0));
}

const COUNTERS = {
  class: (id) => ({
    sections: Section.countDocuments({ classId: id }),
    students: StudentProfile.countDocuments({ classId: id }),
    assignments: TeacherAssignment.countDocuments({ classId: id }),
    attendance: Attendance.countDocuments({ classId: id }),
    assessments: Assessment.countDocuments({ classId: id }),
    meetings: Meeting.countDocuments({ 'invite.classIds': id }),
  }),
  section: (id) => ({
    students: StudentProfile.countDocuments({ sectionId: id }),
    assignments: TeacherAssignment.countDocuments({ sectionId: id }),
    attendance: Attendance.countDocuments({ sectionId: id }),
    assessments: Assessment.countDocuments({ sectionId: id }),
    meetings: Meeting.countDocuments({ 'invite.sectionIds': id }),
  }),
  subject: (id) => ({
    assignments: TeacherAssignment.countDocuments({ subjectId: id }),
    attendance: Attendance.countDocuments({ subjectId: id }),
    assessments: Assessment.countDocuments({ subjectId: id }),
  }),
  session: (id) => ({
    students: StudentProfile.countDocuments({ sessionId: id }),
    assignments: TeacherAssignment.countDocuments({ sessionId: id }),
    attendance: Attendance.countDocuments({ sessionId: id }),
    assessments: Assessment.countDocuments({ sessionId: id }),
    meetings: Meeting.countDocuments({ sessionId: id }),
  }),
};

/** Non-zero reference counts, e.g. { students: 5, attendance: 550 }. */
export async function countReferences(kind, id) {
  const pending = COUNTERS[kind](id);
  const entries = await Promise.all(
    Object.entries(pending).map(async ([key, promise]) => [key, await promise]),
  );
  return Object.fromEntries(entries.filter(([, count]) => count > 0));
}

/** "5 students, 550 attendance records and 5 teacher assignments" */
export function describeCounts(counts) {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const [one, many] = LABELS[key] ?? [key, key];
      return `${n} ${n === 1 ? one : many}`;
    });
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** Throw 409 IN_USE if anything references the entity. */
export async function assertNotReferenced(kind, id, label) {
  const counts = await countReferences(kind, id);
  if (Object.keys(counts).length) {
    throw ApiError.conflict(
      `Cannot delete ${label}: ${describeCounts(counts)} use it.`,
      undefined,
      {
        code: ERROR_CODES.IN_USE,
        details: { references: counts },
      },
    );
  }
}

/**
 * Ownership / scope checks shared by middleware (middleware/ownership.js) and services.
 * Admins may access everything; teachers only their assignments in the active session;
 * students only their own records.
 */
import { ROLES } from '../config/constants.js';
import { AcademicSession, StudentProfile, TeacherAssignment } from '../models/index.js';

export async function getActiveSessionId() {
  const session = await AcademicSession.findOne({ isActive: true }).select('_id').lean();
  return session?._id ?? null;
}

/**
 * Does the teacher hold an assignment for this class-section (and subject, if given)
 * in the active session?
 */
export async function teacherHasAssignment(teacherId, { classId, sectionId, subjectId }) {
  const sessionId = await getActiveSessionId();
  if (!sessionId || !classId || !sectionId) return false;

  const filter = { teacherId, classId, sectionId, sessionId };
  if (subjectId) filter.subjectId = subjectId;
  return Boolean(await TeacherAssignment.exists(filter));
}

/** May `user` act on this class-section (+ optional subject)? */
export async function canAccessClassSection(user, scope) {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.TEACHER) return teacherHasAssignment(user.id, scope);
  return false;
}

/**
 * May `user` read records of this student (a User id)?
 * Student: only themselves. Teacher: only students in a class-section they are assigned to.
 */
export async function canAccessStudent(user, studentId) {
  if (!studentId) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.STUDENT) return String(studentId) === String(user.id);
  if (user.role === ROLES.TEACHER) {
    const sessionId = await getActiveSessionId();
    if (!sessionId) return false;
    const profile = await StudentProfile.findOne({ userId: studentId, sessionId })
      .select('classId sectionId')
      .lean();
    if (!profile) return false;
    return teacherHasAssignment(user.id, {
      classId: profile.classId,
      sectionId: profile.sectionId,
    });
  }
  return false;
}

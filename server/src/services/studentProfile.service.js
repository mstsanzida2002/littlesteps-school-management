/**
 * The signed-in student's own profile (FR-STU-01), read by the guardian: the child, the
 * placement in the active session, the guardian on file and the teachers by subject.
 */
import { ASSIGNMENT_STATUS } from '../config/constants.js';
import { StudentProfile, TeacherAssignment, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { toDateKey } from '../utils/date.js';
import { classSectionLabel, requireActiveSession } from './lookup.service.js';

const dateKeyOrNull = (date) => (date ? toDateKey(date) : null);

/** GET /api/students/me */
export async function myProfile(actor) {
  const session = await requireActiveSession();
  const [user, profile] = await Promise.all([
    User.findById(actor.id).select('name username email').lean(),
    StudentProfile.findOne({ userId: actor.id, sessionId: session._id })
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .lean(),
  ]);
  if (!user || !profile) throw ApiError.notFound('Not enrolled in the current school year');

  // Teachers by subject: names only (no phone numbers or emails for guardians).
  const assignments = await TeacherAssignment.find({
    classId: profile.classId._id,
    sectionId: profile.sectionId._id,
    sessionId: session._id,
    status: ASSIGNMENT_STATUS.ACTIVE,
  })
    .populate('subjectId', 'name')
    .populate('teacherId', 'name')
    .lean();
  const bySubject = new Map();
  for (const a of assignments) {
    if (!a.subjectId || !a.teacherId) continue;
    const key = String(a.subjectId._id);
    if (!bySubject.has(key)) {
      bySubject.set(key, {
        subject: { _id: a.subjectId._id, name: a.subjectId.name },
        teachers: [],
      });
    }
    bySubject.get(key).teachers.push({ _id: a.teacherId._id, name: a.teacherId.name });
  }
  const teachers = [...bySubject.values()].sort((x, y) =>
    x.subject.name.localeCompare(y.subject.name),
  );
  for (const row of teachers) row.teachers.sort((x, y) => x.name.localeCompare(y.name));

  const { guardian = {} } = profile;
  return {
    student: {
      id: user._id,
      name: user.name,
      nickname: profile.nickname ?? null,
      username: user.username,
      email: user.email ?? null,
      classId: profile.classId._id,
      className: profile.classId.name,
      sectionId: profile.sectionId._id,
      sectionName: profile.sectionId.name,
      classSection: classSectionLabel(profile.classId, profile.sectionId),
      rollNo: profile.rollNo,
      dateOfBirth: dateKeyOrNull(profile.dateOfBirth),
      gender: profile.gender ?? null,
      admissionDate: dateKeyOrNull(profile.admissionDate),
    },
    session: {
      name: session.name,
      startDate: dateKeyOrNull(session.startDate),
      endDate: dateKeyOrNull(session.endDate),
    },
    guardian: {
      name: guardian.name,
      relation: guardian.relation,
      phone: guardian.phone,
      email: guardian.email ?? null,
      address: guardian.address ?? null,
    },
    teachers,
  };
}

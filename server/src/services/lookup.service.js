/**
 * Small shared lookups/validations used by several admin services.
 */
import { ERROR_CODES } from '../config/constants.js';
import { AcademicSession, Class, Section, StudentProfile } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

/** The active academic session, or 422 if none is active. */
export async function requireActiveSession({ session } = {}) {
  const active = await AcademicSession.findOne({ isActive: true }).session(session ?? null);
  if (!active) {
    throw ApiError.unprocessable(
      'No academic session is active. Activate a session first (POST /api/sessions/:id/activate).',
    );
  }
  return active;
}

/** Load a class + section and ensure the section belongs to the class (422 otherwise). */
export async function requireSectionInClass(classId, sectionId, { session } = {}) {
  const [cls, section] = await Promise.all([
    Class.findById(classId).session(session ?? null),
    Section.findById(sectionId).session(session ?? null),
  ]);
  if (!cls) throw ApiError.invalidField('classId', 'Class not found');
  if (!section) throw ApiError.invalidField('sectionId', 'Section not found');
  if (!section.classId.equals(cls._id)) {
    throw ApiError.invalidField('sectionId', `Section ${section.name} is not part of ${cls.name}`);
  }
  return { cls, section };
}

export const classSectionLabel = (cls, section) => `${cls.name}-${section.name}`;

/** Highest roll number + 1 in a class-section-session, plus the numbers already taken. */
export async function nextRollNumber({ classId, sectionId, sessionId }, { session } = {}) {
  const taken = await StudentProfile.find({ classId, sectionId, sessionId })
    .session(session ?? null)
    .select('rollNo')
    .sort({ rollNo: 1 })
    .lean();
  const numbers = taken.map((p) => p.rollNo);
  return { suggestedRollNo: (numbers.at(-1) ?? 0) + 1, taken: numbers };
}

const isRollConflict = (err) => err?.code === 11000 && err.keyPattern?.rollNo;

/**
 * Turn a duplicate-key error on the roll-number index into a clear 409; rethrow anything else.
 */
export async function rethrowRollConflict(err, { classId, sectionId, sessionId, rollNo }) {
  if (!isRollConflict(err)) throw err;
  const [{ cls, section }, sessionDoc, next] = await Promise.all([
    requireSectionInClass(classId, sectionId),
    AcademicSession.findById(sessionId).lean(),
    nextRollNumber({ classId, sectionId, sessionId }),
  ]);
  const label = `${classSectionLabel(cls, section)} (${sessionDoc?.name ?? 'session'})`;
  throw ApiError.conflict(
    `Roll ${rollNo} is already taken in ${label}. Next free: ${next.suggestedRollNo}.`,
    [{ field: 'rollNo', message: `Roll ${rollNo} is already taken` }],
    { code: ERROR_CODES.ROLL_NUMBER_TAKEN, details: next },
  );
}

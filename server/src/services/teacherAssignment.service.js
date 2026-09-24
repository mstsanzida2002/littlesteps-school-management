/**
 * Teacher assignments (FR-ADM-04): teacher × class × section × subject in the active session,
 * with an optional weekly timetable.
 *
 * Timetable integrity (the "mark once per day" attendance flow relies on it):
 *  - a teacher cannot be in two places at once;
 *  - a class-section cannot have two subjects at overlapping times on the same day
 *    (regardless of teacher).
 * Slots are half-open [start, end), so 09:00–09:30 and 09:30–10:00 do not clash.
 */
import { ACCOUNT_STATUS, ASSIGNMENT_STATUS, ERROR_CODES, ROLES } from '../config/constants.js';
import { Assessment, Attendance, Subject, TeacherAssignment, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/listQuery.js';
import { recordAudit } from './audit.service.js';
import { describeCounts } from './reference.service.js';
import { requireActiveSession, requireSectionInClass } from './lookup.service.js';

const POPULATE = [
  { path: 'teacherId', select: 'name username status' },
  { path: 'classId', select: 'name order' },
  { path: 'sectionId', select: 'name' },
  { path: 'subjectId', select: 'name code' },
  { path: 'sessionId', select: 'name isActive' },
];

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const slotsOverlap = (a, b) =>
  a.day === b.day && a.startTime < b.endTime && b.startTime < a.endTime;
const slotLabel = (slot) => `${capitalize(slot.day)} ${slot.startTime}–${slot.endTime}`;

/**
 * Find timetable clashes for a proposed schedule against other ACTIVE assignments in the same
 * session: same teacher (teacher clash) or same class-section (class-section clash).
 */
export async function findScheduleClashes({
  sessionId,
  teacherId,
  classId,
  sectionId,
  schedule,
  excludeId,
}) {
  if (!schedule?.length) return [];
  const others = await TeacherAssignment.find({
    sessionId,
    status: ASSIGNMENT_STATUS.ACTIVE,
    ...(excludeId && { _id: { $ne: excludeId } }),
    $or: [{ teacherId }, { classId, sectionId }],
    'schedule.day': { $in: [...new Set(schedule.map((s) => s.day))] },
  })
    .populate(POPULATE)
    .lean();

  const clashes = [];
  for (const other of others) {
    const sameTeacher = String(other.teacherId._id) === String(teacherId);
    const sameClassSection =
      String(other.classId._id) === String(classId) &&
      String(other.sectionId._id) === String(sectionId);
    for (const slot of schedule) {
      for (const otherSlot of other.schedule) {
        if (!slotsOverlap(slot, otherSlot)) continue;
        const where = `${other.classId.name}-${other.sectionId.name}`;
        const base = {
          assignmentId: other._id,
          slot,
          conflictingSlot: otherSlot,
          teacher: other.teacherId.name,
          classSection: where,
          subject: other.subjectId.name,
        };
        if (sameTeacher) {
          clashes.push({
            ...base,
            type: 'teacher',
            message: `${other.teacherId.name} already teaches ${other.subjectId.name} to ${where} on ${slotLabel(otherSlot)}.`,
          });
        }
        if (sameClassSection) {
          clashes.push({
            ...base,
            type: 'classSection',
            message: `${where} already has ${other.subjectId.name} (${other.teacherId.name}) on ${slotLabel(otherSlot)}.`,
          });
        }
      }
    }
  }
  return clashes;
}

async function assertNoClashes(params) {
  const clashes = await findScheduleClashes(params);
  if (clashes.length) {
    throw ApiError.conflict(clashes.map((c) => c.message).join(' '), undefined, {
      code: ERROR_CODES.SCHEDULE_CLASH,
      details: { clashes },
    });
  }
}

async function requireAssignment(id) {
  const assignment = await TeacherAssignment.findById(id);
  if (!assignment) throw ApiError.notFound('Teacher assignment not found');
  return assignment;
}

const getAssignment = (id) => TeacherAssignment.findById(id).populate(POPULATE).lean();

// ---------------------------------------------------------------------------

/** GET /api/teacher-assignments — defaults to the active session. */
export async function listAssignments({
  page,
  limit,
  sort,
  sessionId,
  teacherId,
  classId,
  sectionId,
  subjectId,
  status,
}) {
  const filter = { sessionId: sessionId ?? (await requireActiveSession())._id };
  if (teacherId) filter.teacherId = teacherId;
  if (classId) filter.classId = classId;
  if (sectionId) filter.sectionId = sectionId;
  if (subjectId) filter.subjectId = subjectId;
  if (status) filter.status = status;
  const { items, meta } = await paginate(TeacherAssignment, filter, {
    page,
    limit,
    sort,
    populate: POPULATE,
  });
  // hasSchedule lets the admin UI warn: without a schedule the assignment never appears in the
  // "mark once" flow unless the teacher picks the subject manually.
  return { items: items.map((a) => ({ ...a, hasSchedule: a.schedule.length > 0 })), meta };
}

/** POST /api/teacher-assignments — always in the active session. Re-assigning an ended combo reactivates it. */
export async function createAssignment(
  actor,
  { teacherId, classId, sectionId, subjectId, schedule = [] },
  meta = {},
) {
  const activeSession = await requireActiveSession();
  const teacher = await User.findById(teacherId).select('role status name').lean();
  if (!teacher || teacher.role !== ROLES.TEACHER) {
    throw ApiError.invalidField('teacherId', 'User is not a teacher');
  }
  if (teacher.status !== ACCOUNT_STATUS.ACTIVE) {
    throw ApiError.invalidField('teacherId', `Teacher account is ${teacher.status}`);
  }
  await requireSectionInClass(classId, sectionId);
  if (!(await Subject.exists({ _id: subjectId }))) {
    throw ApiError.invalidField('subjectId', 'Subject not found');
  }

  const combo = { teacherId, classId, sectionId, subjectId, sessionId: activeSession._id };
  const existing = await TeacherAssignment.findOne(combo);
  if (existing?.status === ASSIGNMENT_STATUS.ACTIVE) {
    throw ApiError.conflict('This teacher is already assigned to this class, section and subject.');
  }

  await assertNoClashes({ ...combo, schedule, excludeId: existing?._id });

  let assignment;
  let action;
  if (existing) {
    existing.set({
      status: ASSIGNMENT_STATUS.ACTIVE,
      schedule,
      endedAt: undefined,
      endedBy: undefined,
    });
    assignment = await existing.save();
    action = 'assignment.reactivate';
  } else {
    assignment = await TeacherAssignment.create({ ...combo, schedule });
    action = 'assignment.create';
  }
  await recordAudit({
    actorId: actor.id,
    action,
    entityType: 'TeacherAssignment',
    entityId: assignment._id,
    after: { ...combo, schedule, status: ASSIGNMENT_STATUS.ACTIVE },
    meta,
  });
  return getAssignment(assignment._id);
}

/** PATCH /api/teacher-assignments/:id — replace the weekly schedule. */
export async function updateAssignmentSchedule(actor, id, { schedule }, meta = {}) {
  const assignment = await requireAssignment(id);
  if (assignment.status !== ASSIGNMENT_STATUS.ACTIVE) {
    throw ApiError.conflict('Ended assignments cannot be edited. Re-assign the teacher instead.');
  }
  await assertNoClashes({
    sessionId: assignment.sessionId,
    teacherId: assignment.teacherId,
    classId: assignment.classId,
    sectionId: assignment.sectionId,
    schedule,
    excludeId: assignment._id,
  });

  const before = assignment.toObject().schedule;
  assignment.schedule = schedule;
  await assignment.save();
  await recordAudit({
    actorId: actor.id,
    action: 'assignment.update',
    entityType: 'TeacherAssignment',
    entityId: assignment._id,
    before: { schedule: before },
    after: { schedule },
    meta,
  });
  return getAssignment(assignment._id);
}

/**
 * DELETE /api/teacher-assignments/:id — deleted if nothing was recorded under it; otherwise
 * ended (kept for history, no longer grants access). Returns { outcome: 'deleted' | 'ended' }.
 */
export async function removeAssignment(actor, id, meta = {}) {
  const assignment = await requireAssignment(id);
  const { teacherId, classId, sectionId, subjectId, sessionId } = assignment;
  const [attendance, assessments] = await Promise.all([
    Attendance.countDocuments({ teacherId, classId, sectionId, subjectId, sessionId }),
    Assessment.countDocuments({ createdBy: teacherId, classId, sectionId, subjectId, sessionId }),
  ]);

  if (attendance || assessments) {
    if (assignment.status !== ASSIGNMENT_STATUS.ENDED) {
      assignment.set({ status: ASSIGNMENT_STATUS.ENDED, endedAt: new Date(), endedBy: actor.id });
      await assignment.save();
      await recordAudit({
        actorId: actor.id,
        action: 'assignment.end',
        entityType: 'TeacherAssignment',
        entityId: assignment._id,
        before: { status: ASSIGNMENT_STATUS.ACTIVE },
        after: { status: ASSIGNMENT_STATUS.ENDED, attendance, assessments },
        meta,
      });
    }
    return {
      outcome: 'ended',
      message: `Assignment ended instead of deleted because it has history (${describeCounts({ attendance, assessments })}).`,
      assignment: await getAssignment(assignment._id),
    };
  }

  await assignment.deleteOne();
  await recordAudit({
    actorId: actor.id,
    action: 'assignment.delete',
    entityType: 'TeacherAssignment',
    entityId: assignment._id,
    before: assignment.toObject(),
    meta,
  });
  return { outcome: 'deleted', message: 'Assignment deleted.' };
}

/**
 * Academic structure (FR-ADM-03): classes, sections, subjects, academic sessions.
 * Deletes are refused with 409 IN_USE while anything references the entity.
 */
import { ERROR_CODES } from '../config/constants.js';
import {
  AcademicSession,
  Class,
  Section,
  StudentProfile,
  Subject,
  TeacherAssignment,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { toDateKey } from '../utils/date.js';
import { paginate, searchFilter } from '../utils/listQuery.js';
import { withTransaction } from '../utils/transaction.js';
import { diffChanges, recordAudit } from './audit.service.js';
import { requireActiveSession } from './lookup.service.js';
import { assertNotReferenced } from './reference.service.js';

async function requireDoc(Model, id, label) {
  const doc = await Model.findById(id);
  if (!doc) throw ApiError.notFound(`${label} not found`);
  return doc;
}

/** Apply `changes` to `doc`, save, and audit only the fields that actually changed. */
async function auditedUpdate(actor, doc, changes, { action, entityType, meta }) {
  const before = doc.toObject();
  doc.set(changes);
  await doc.save();
  const diff = diffChanges(before, doc.toObject());
  await recordAudit({ actorId: actor.id, action, entityType, entityId: doc._id, ...diff, meta });
  return doc;
}

async function auditedCreate(actor, Model, data, { action, entityType, meta }) {
  const doc = await Model.create(data);
  await recordAudit({
    actorId: actor.id,
    action,
    entityType,
    entityId: doc._id,
    after: doc.toObject(),
    meta,
  });
  return doc;
}

async function auditedDelete(actor, doc, { action, entityType, meta }) {
  await doc.deleteOne();
  await recordAudit({
    actorId: actor.id,
    action,
    entityType,
    entityId: doc._id,
    before: doc.toObject(),
    meta,
  });
}

/** Map of id → count for `groupField` in StudentProfile, limited to one session. */
async function studentCounts(groupField, sessionId) {
  if (!sessionId) return new Map();
  const rows = await StudentProfile.aggregate([
    { $match: { sessionId } },
    { $group: { _id: `$${groupField}`, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

const activeSessionIdOrNull = async () =>
  (await AcademicSession.findOne({ isActive: true }).select('_id').lean())?._id ?? null;

// ---------------------------------------------------------------------------
// Classes

export async function listClasses({ page, limit, sort, search }) {
  const { items, meta } = await paginate(Class, searchFilter(search, ['name']), {
    page,
    limit,
    sort,
  });
  const [sectionRows, students] = await Promise.all([
    Section.aggregate([{ $group: { _id: '$classId', count: { $sum: 1 } } }]),
    studentCounts('classId', await activeSessionIdOrNull()),
  ]);
  const sections = new Map(sectionRows.map((r) => [String(r._id), r.count]));
  return {
    items: items.map((c) => ({
      ...c,
      sectionCount: sections.get(String(c._id)) ?? 0,
      studentCount: students.get(String(c._id)) ?? 0,
    })),
    meta,
  };
}

export const getClass = async (id) => (await requireDoc(Class, id, 'Class')).toJSON();

export const createClass = (actor, data, meta) =>
  auditedCreate(actor, Class, data, { action: 'class.create', entityType: 'Class', meta });

export async function updateClass(actor, id, data, meta) {
  const doc = await requireDoc(Class, id, 'Class');
  return auditedUpdate(actor, doc, data, { action: 'class.update', entityType: 'Class', meta });
}

export async function deleteClass(actor, id, meta) {
  const doc = await requireDoc(Class, id, 'Class');
  await assertNotReferenced('class', id, `class ${doc.name}`);
  await auditedDelete(actor, doc, { action: 'class.delete', entityType: 'Class', meta });
}

// ---------------------------------------------------------------------------
// Sections

export async function listSections({ page, limit, sort, search, classId }) {
  const filter = searchFilter(search, ['name']);
  if (classId) filter.classId = classId;
  const { items, meta } = await paginate(Section, filter, {
    page,
    limit,
    sort,
    populate: { path: 'classId', select: 'name order' },
  });
  const students = await studentCounts('sectionId', await activeSessionIdOrNull());
  return {
    items: items.map((s) => ({ ...s, studentCount: students.get(String(s._id)) ?? 0 })),
    meta,
  };
}

export async function getSection(id) {
  const doc = await Section.findById(id).populate('classId', 'name order').lean();
  if (!doc) throw ApiError.notFound('Section not found');
  return doc;
}

export async function createSection(actor, data, meta) {
  if (!(await Class.exists({ _id: data.classId }))) {
    throw ApiError.invalidField('classId', 'Class not found');
  }
  return auditedCreate(actor, Section, data, {
    action: 'section.create',
    entityType: 'Section',
    meta,
  });
}

export async function updateSection(actor, id, data, meta) {
  const doc = await requireDoc(Section, id, 'Section');
  if (data.classId && String(data.classId) !== String(doc.classId)) {
    throw ApiError.badRequest(
      'A section cannot move to another class. Create a new section instead.',
      [{ field: 'classId', message: 'Cannot be changed' }],
    );
  }
  if (data.capacity !== undefined) {
    const sessionId = await activeSessionIdOrNull();
    const enrolled = sessionId
      ? await StudentProfile.countDocuments({ sectionId: id, sessionId })
      : 0;
    if (data.capacity < enrolled) {
      throw ApiError.conflict(
        `Capacity ${data.capacity} is below the ${enrolled} students currently enrolled.`,
      );
    }
  }
  const { classId: _ignored, ...changes } = data;
  return auditedUpdate(actor, doc, changes, {
    action: 'section.update',
    entityType: 'Section',
    meta,
  });
}

export async function deleteSection(actor, id, meta) {
  const doc = await Section.findById(id).populate('classId', 'name');
  if (!doc) throw ApiError.notFound('Section not found');
  await assertNotReferenced('section', id, `section ${doc.classId?.name ?? ''}-${doc.name}`);
  await auditedDelete(actor, doc, { action: 'section.delete', entityType: 'Section', meta });
}

// ---------------------------------------------------------------------------
// Subjects

export const listSubjects = ({ page, limit, sort, search }) =>
  paginate(Subject, searchFilter(search, ['name', 'code']), { page, limit, sort });

export const getSubject = async (id) => (await requireDoc(Subject, id, 'Subject')).toJSON();

export const createSubject = (actor, data, meta) =>
  auditedCreate(actor, Subject, data, { action: 'subject.create', entityType: 'Subject', meta });

export async function updateSubject(actor, id, data, meta) {
  const doc = await requireDoc(Subject, id, 'Subject');
  return auditedUpdate(actor, doc, data, {
    action: 'subject.update',
    entityType: 'Subject',
    meta,
  });
}

export async function deleteSubject(actor, id, meta) {
  const doc = await requireDoc(Subject, id, 'Subject');
  await assertNotReferenced('subject', id, `subject ${doc.name}`);
  await auditedDelete(actor, doc, { action: 'subject.delete', entityType: 'Subject', meta });
}

// ---------------------------------------------------------------------------
// Academic sessions

export async function listSessions({ page, limit, sort, search }) {
  const { items, meta } = await paginate(AcademicSession, searchFilter(search, ['name']), {
    page,
    limit,
    sort,
  });
  const students = await StudentProfile.aggregate([
    { $match: { sessionId: { $in: items.map((s) => s._id) } } },
    { $group: { _id: '$sessionId', count: { $sum: 1 } } },
  ]);
  const counts = new Map(students.map((r) => [String(r._id), r.count]));
  return {
    items: items.map((s) => ({ ...s, studentCount: counts.get(String(s._id)) ?? 0 })),
    meta,
  };
}

export const getSession = async (id) => (await requireDoc(AcademicSession, id, 'Session')).toJSON();

// New sessions start inactive; use activateSession to switch.
export const createSession = (actor, { name, startDate, endDate }, meta) =>
  auditedCreate(
    actor,
    AcademicSession,
    { name, startDate, endDate, isActive: false },
    { action: 'session.create', entityType: 'AcademicSession', meta },
  );

export async function updateSession(actor, id, data, meta) {
  const doc = await requireDoc(AcademicSession, id, 'Session');
  // Compare the merged dates: the model validator only runs for modified paths.
  const start = data.startDate ?? toDateKey(doc.startDate);
  const end = data.endDate ?? toDateKey(doc.endDate);
  if (end <= start) throw ApiError.invalidField('endDate', 'endDate must be after startDate');
  return auditedUpdate(actor, doc, data, {
    action: 'session.update',
    entityType: 'AcademicSession',
    meta,
  });
}

export async function deleteSession(actor, id, meta) {
  const doc = await requireDoc(AcademicSession, id, 'Session');
  if (doc.isActive) {
    throw ApiError.conflict(
      'The active session cannot be deleted. Activate another session first.',
    );
  }
  await assertNotReferenced('session', id, `session ${doc.name}`);
  await auditedDelete(actor, doc, {
    action: 'session.delete',
    entityType: 'AcademicSession',
    meta,
  });
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * POST /api/sessions/:id/activate — switching the active session changes what every teacher
 * sees, so without `confirm: true` it only returns 409 with an enrolment summary.
 */
export async function activateSession(actor, id, { confirm } = {}, meta = {}) {
  const target = await requireDoc(AcademicSession, id, 'Session');
  if (target.isActive) throw ApiError.conflict(`${target.name} is already the active session.`);
  const current = await AcademicSession.findOne({ isActive: true });

  if (current && !confirm) {
    const summarize = async (session) => ({
      id: session._id,
      name: session.name,
      students: await StudentProfile.countDocuments({ sessionId: session._id }),
      assignments: await TeacherAssignment.countDocuments({
        sessionId: session._id,
        status: 'active',
      }),
    });
    const [from, to] = await Promise.all([summarize(current), summarize(target)]);
    const enrolled = (n) => plural(n, 'student is', 'students are');
    throw ApiError.conflict(
      `${enrolled(from.students)} enrolled in ${from.name} and ${to.students} in ${to.name}. ` +
        'Teachers will not see unenrolled students after switching. ' +
        `Teacher assignments: ${from.assignments} in ${from.name}, ${to.assignments} in ${to.name}. ` +
        'Send { "confirm": true } to switch.',
      undefined,
      {
        code: ERROR_CODES.SESSION_SWITCH_CONFIRMATION_REQUIRED,
        details: { current: from, target: to },
      },
    );
  }

  await withTransaction(async (session) => {
    // Deactivate first so the "only one active" partial unique index is never violated.
    if (current) {
      await AcademicSession.updateOne({ _id: current._id }, { isActive: false }, { session });
    }
    await AcademicSession.updateOne({ _id: target._id }, { isActive: true }, { session });
    await recordAudit(
      {
        actorId: actor.id,
        action: 'session.activate',
        entityType: 'AcademicSession',
        entityId: target._id,
        before: { activeSession: current ? { id: current._id, name: current.name } : null },
        after: { activeSession: { id: target._id, name: target.name } },
        meta,
      },
      { session },
    );
  });
  return (await requireActiveSession()).toJSON();
}

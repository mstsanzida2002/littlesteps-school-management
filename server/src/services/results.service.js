/**
 * Results (FR-TCH-08…12) and the results part of the admin override (FR-ADM-09).
 *
 * - Teachers manage assessments only for class-section-subjects in their active assignments
 *   (any teacher assigned to that subject, so substitutes can help); admins manage any.
 * - Drafts: bulk-saved, freely editable, graded with the CURRENT scale when saved (provisional).
 * - Publish: every enrolled student needs a complete entry; ONE transaction snapshots the scale onto
 *   the assessment, regrades non-overridden marks entries with it, publishes, and creates one
 *   notification per student. No unpublishing (v1).
 * - Published edits: reason required, audited before/after, the student notified, graded with the
 *   assessment's own snapshot — never with a newer Settings scale.
 * - Students only ever see results of PUBLISHED assessments (enforced in the query).
 */
import mongoose from 'mongoose';

import { ASSIGNMENT_STATUS, ERROR_CODES, ROLES } from '../config/constants.js';
import { ASSESSMENT_MODES, ASSESSMENT_STATUS } from '../models/assessment.model.js';
import { Assessment, Result, Settings, Subject, TeacherAssignment } from '../models/index.js';
import { RESULT_ATTENDANCE } from '../models/result.model.js';
import { ApiError } from '../utils/ApiError.js';
import { formatSchoolDateLong, toDateKey, toSchoolDate, todaySchoolDate } from '../utils/date.js';
import { paginate } from '../utils/listQuery.js';
import { withTransaction } from '../utils/transaction.js';
import { teacherHasAssignment } from './access.service.js';
import { enrolledStudents } from './attendanceRules.js';
import { diffChanges, recordAudit } from './audit.service.js';
import { gradeFor, percentOf, scaleGrades, snapshotScale } from './grading.js';
import {
  classSectionLabel,
  requireActiveSession,
  requireSectionInClass,
} from './lookup.service.js';
import { createNotifications, createOutbox, dispatchOutbox } from './notification.service.js';

const POPULATE = [
  { path: 'subjectId', select: 'name code' },
  { path: 'classId', select: 'name order' },
  { path: 'sectionId', select: 'name' },
];
const ATTENDANCE_LABEL = { absent: 'Absent', excused: 'Excused' };

// ---------------------------------------------------------------------------
// Access

async function assertCanManage(actor, { classId, sectionId, subjectId, sessionId }) {
  if (actor.role === ROLES.ADMIN) return;
  const active = await requireActiveSession();
  const allowed =
    String(active._id) === String(sessionId ?? active._id) &&
    (await teacherHasAssignment(actor.id, { classId, sectionId, subjectId }));
  if (!allowed) {
    throw ApiError.forbidden(
      'You can only manage assessments for subjects you teach in this class.',
    );
  }
}

async function requireAssessment(id) {
  const assessment = await Assessment.findById(id);
  if (!assessment) throw ApiError.notFound('Assessment not found');
  return assessment;
}

const assertDraft = (assessment) => {
  if (assessment.status !== ASSESSMENT_STATUS.DRAFT) {
    throw ApiError.conflict(
      'This assessment is published. Edit individual results instead (PATCH /api/results/:id).',
      undefined,
      { code: ERROR_CODES.ASSESSMENT_PUBLISHED },
    );
  }
};

const assertDateReached = (assessment) => {
  if (assessment.date > todaySchoolDate()) {
    throw ApiError.unprocessable(
      `Results can be entered from the assessment date (${formatSchoolDateLong(assessment.date)}).`,
    );
  }
};

/** Students expected in an assessment: enrolled in its class-section and admitted by its date. */
const rosterFor = (assessment) =>
  enrolledStudents({
    classId: assessment.classId,
    sectionId: assessment.sectionId,
    sessionId: assessment.sessionId,
    date: assessment.date,
  });

// ---------------------------------------------------------------------------
// Entry normalization

/**
 * Validate one entry against the assessment mode and compute percent/grade.
 * Returns { value, errors[] }; `value` has every result field ($unset when undefined).
 */
export function normalizeEntry(assessment, entry, scale, prefix = 'entry') {
  const errors = [];
  const fail = (field, message) => errors.push({ field: `${prefix}.${field}`, message });
  const attendance = entry.attendance ?? RESULT_ATTENDANCE.PRESENT;
  const remarks = entry.remarks?.trim() || undefined;
  const hasMarks = entry.marksObtained !== undefined && entry.marksObtained !== null;
  const hasGrade = Boolean(entry.grade);
  const value = {
    attendance,
    remarks,
    marksObtained: undefined,
    percent: undefined,
    grade: undefined,
    gradeOverridden: false,
  };

  if (attendance !== RESULT_ATTENDANCE.PRESENT) {
    if (hasMarks || hasGrade) {
      fail('attendance', `${ATTENDANCE_LABEL[attendance]} students cannot have marks or a grade`);
    }
    return { value, errors };
  }

  if (hasGrade && !scaleGrades(scale).includes(entry.grade)) {
    fail('grade', `Grade must be one of: ${scaleGrades(scale).join(', ')}`);
  }

  if (assessment.mode === ASSESSMENT_MODES.MARKS) {
    if (hasMarks) {
      if (entry.marksObtained > assessment.totalMarks) {
        fail('marksObtained', `Marks cannot exceed the total of ${assessment.totalMarks}`);
      } else {
        value.marksObtained = entry.marksObtained;
        value.percent = percentOf(entry.marksObtained, assessment.totalMarks);
        const calculated = gradeFor(value.percent, scale);
        value.grade = hasGrade ? entry.grade : calculated;
        value.gradeOverridden = hasGrade && entry.grade !== calculated;
      }
    } else if (hasGrade) {
      fail('grade', 'Enter the marks first; the grade is calculated from them');
    }
  } else if (assessment.mode === ASSESSMENT_MODES.GRADE) {
    if (hasMarks) fail('marksObtained', 'This assessment is graded without marks');
    if (hasGrade) value.grade = entry.grade;
  } else if (hasMarks || hasGrade) {
    fail('marksObtained', 'This assessment is remarks-only (no marks or grade)');
  }
  return { value, errors };
}

/** What a present student still lacks for publishing (null when complete). */
function missingPart(assessment, result) {
  if (result.attendance !== RESULT_ATTENDANCE.PRESENT) return null;
  if (assessment.mode === ASSESSMENT_MODES.MARKS && result.marksObtained == null) return 'marks';
  if (assessment.mode === ASSESSMENT_MODES.GRADE && !result.grade) return 'grade';
  if (assessment.mode === ASSESSMENT_MODES.REMARKS && !result.remarks) return 'remarks';
  return null;
}

const setAndUnset = (value) => {
  const $set = {};
  const $unset = {};
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) $unset[key] = '';
    else $set[key] = v;
  }
  return Object.keys($unset).length ? { $set, $unset } : { $set };
};

// ---------------------------------------------------------------------------
// Assessments

/** POST /api/assessments */
export async function createAssessment(actor, data, meta = {}) {
  const activeSession = await requireActiveSession();
  const { cls, section } = await requireSectionInClass(data.classId, data.sectionId);
  if (!(await Subject.exists({ _id: data.subjectId }))) {
    throw ApiError.invalidField('subjectId', 'Subject not found');
  }
  await assertCanManage(actor, { ...data, sessionId: activeSession._id });

  const date = toSchoolDate(data.date);
  if (date < activeSession.startDate || date > activeSession.endDate) {
    throw ApiError.invalidField(
      'date',
      `Date must be within the active session ${activeSession.name}`,
    );
  }
  const assessment = await Assessment.create({
    name: data.name,
    type: data.type,
    mode: data.mode,
    totalMarks: data.mode === ASSESSMENT_MODES.MARKS ? data.totalMarks : undefined,
    date: data.date,
    classId: data.classId,
    sectionId: data.sectionId,
    subjectId: data.subjectId,
    sessionId: activeSession._id,
    createdBy: actor.id,
  });
  await recordAudit({
    actorId: actor.id,
    action: 'assessment.create',
    entityType: 'Assessment',
    entityId: assessment._id,
    after: { ...assessment.toObject(), classSection: classSectionLabel(cls, section) },
    meta,
  });
  return getAssessment(actor, assessment._id);
}

/** GET /api/assessments — teachers: only their active class-section-subjects. */
export async function listAssessments(
  actor,
  { page, limit, sort, classId, sectionId, subjectId, status },
) {
  const activeSession = await requireActiveSession();
  const filter = { sessionId: activeSession._id };
  if (classId) filter.classId = classId;
  if (sectionId) filter.sectionId = sectionId;
  if (subjectId) filter.subjectId = subjectId;
  if (status) filter.status = status;
  if (actor.role === ROLES.TEACHER) {
    const own = await TeacherAssignment.find({
      teacherId: actor.id,
      sessionId: activeSession._id,
      status: ASSIGNMENT_STATUS.ACTIVE,
    })
      .select('classId sectionId subjectId')
      .lean();
    if (!own.length) return { items: [], meta: { page, limit, total: 0, totalPages: 1 } };
    filter.$or = own.map(({ classId: c, sectionId: s, subjectId: sub }) => ({
      classId: c,
      sectionId: s,
      subjectId: sub,
    }));
  }
  const { items, meta } = await paginate(Assessment, filter, {
    page,
    limit,
    sort,
    populate: POPULATE,
  });
  const counts = await Result.aggregate([
    { $match: { assessmentId: { $in: items.map((a) => a._id) } } },
    { $group: { _id: '$assessmentId', entries: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.entries]));
  return {
    items: items.map((a) => ({
      ...a,
      date: toDateKey(a.date),
      entries: byId.get(String(a._id)) ?? 0,
    })),
    meta,
  };
}

/** GET /api/assessments/:id — with entries and the students still missing one. */
export async function getAssessment(actor, id) {
  const assessment = await Assessment.findById(id).populate(POPULATE).lean();
  if (!assessment) throw ApiError.notFound('Assessment not found');
  await assertCanManage(actor, {
    classId: assessment.classId._id,
    sectionId: assessment.sectionId._id,
    subjectId: assessment.subjectId._id,
    sessionId: assessment.sessionId,
  });
  const [roster, results] = await Promise.all([
    rosterFor({
      ...assessment,
      classId: assessment.classId._id,
      sectionId: assessment.sectionId._id,
    }),
    Result.find({ assessmentId: id }).lean(),
  ]);
  const byStudent = new Map(results.map((r) => [String(r.studentId), r]));
  return {
    ...assessment,
    date: toDateKey(assessment.date),
    students: roster.map((p) => ({
      studentId: p.userId._id,
      name: p.userId.name,
      rollNo: p.rollNo,
      result: byStudent.get(String(p.userId._id)) ?? null,
    })),
  };
}

/** PATCH /api/assessments/:id — drafts only. */
export async function updateAssessment(actor, id, changes, meta = {}) {
  const assessment = await requireAssessment(id);
  await assertCanManage(actor, assessment);
  assertDraft(assessment);
  const results = await Result.find({ assessmentId: id });

  if (changes.mode && changes.mode !== assessment.mode && results.length) {
    throw ApiError.conflict('The mode cannot change once results have been entered.');
  }
  const mode = changes.mode ?? assessment.mode;
  if (changes.totalMarks !== undefined && mode === ASSESSMENT_MODES.MARKS) {
    const highest = Math.max(0, ...results.map((r) => r.marksObtained ?? 0));
    if (changes.totalMarks < highest) {
      throw ApiError.invalidField('totalMarks', `A student already has ${highest} marks`);
    }
  }
  if (changes.date) {
    const activeSession = await requireActiveSession();
    const date = toSchoolDate(changes.date);
    if (date < activeSession.startDate || date > activeSession.endDate) {
      throw ApiError.invalidField(
        'date',
        `Date must be within the active session ${activeSession.name}`,
      );
    }
  }

  const before = assessment.toObject();
  assessment.set({ ...changes, ...(mode !== ASSESSMENT_MODES.MARKS && { totalMarks: undefined }) });
  const { gradingScale: scale } = await Settings.get();

  await withTransaction(async (session) => {
    await assessment.save({ session });
    // New total → recompute provisional percent/grade of non-overridden entries.
    if (changes.totalMarks !== undefined && mode === ASSESSMENT_MODES.MARKS) {
      for (const r of results.filter((x) => x.marksObtained != null && !x.gradeOverridden)) {
        const percent = percentOf(r.marksObtained, assessment.totalMarks);
        await Result.updateOne(
          { _id: r._id },
          { $set: { percent, grade: gradeFor(percent, scale) } },
          { session },
        );
      }
    }
    await recordAudit(
      {
        actorId: actor.id,
        action: 'assessment.update',
        entityType: 'Assessment',
        entityId: assessment._id,
        ...diffChanges(before, assessment.toObject()),
        meta,
      },
      { session },
    );
  });
  return getAssessment(actor, id);
}

/** DELETE /api/assessments/:id — drafts only (with their entries). */
export async function deleteAssessment(actor, id, meta = {}) {
  const assessment = await requireAssessment(id);
  await assertCanManage(actor, assessment);
  assertDraft(assessment);
  await withTransaction(async (session) => {
    const { deletedCount } = await Result.deleteMany({ assessmentId: id }, { session });
    await Assessment.deleteOne({ _id: id }, { session });
    await recordAudit(
      {
        actorId: actor.id,
        action: 'assessment.delete',
        entityType: 'Assessment',
        entityId: assessment._id,
        before: { ...assessment.toObject(), entries: deletedCount },
        meta,
      },
      { session },
    );
  });
}

// ---------------------------------------------------------------------------
// Draft entries

/** PUT /api/results/:assessmentId — bulk upsert of draft entries. */
export async function saveDraftResults(actor, assessmentId, entries, meta = {}) {
  const assessment = await requireAssessment(assessmentId);
  await assertCanManage(actor, assessment);
  assertDraft(assessment);
  assertDateReached(assessment);

  const roster = await rosterFor(assessment);
  const enrolled = new Set(roster.map((p) => String(p.userId._id)));
  const { gradingScale: scale } = await Settings.get();

  const errors = [];
  const seen = new Set();
  const ops = [];
  entries.forEach((entry, i) => {
    if (!enrolled.has(entry.studentId)) {
      errors.push({
        field: `entries.${i}.studentId`,
        message: 'Student is not enrolled in this class',
      });
      return;
    }
    if (seen.has(entry.studentId)) {
      errors.push({ field: `entries.${i}.studentId`, message: 'Student appears more than once' });
      return;
    }
    seen.add(entry.studentId);
    const { value, errors: entryErrors } = normalizeEntry(assessment, entry, scale, `entries.${i}`);
    errors.push(...entryErrors);
    const { $set, $unset } = setAndUnset({ ...value, updatedBy: actor.id });
    ops.push({
      updateOne: {
        filter: { assessmentId: assessment._id, studentId: entry.studentId },
        update: { $set, ...($unset && { $unset }) },
        upsert: true,
      },
    });
  });
  if (errors.length) throw ApiError.unprocessable('Some entries are invalid', errors);

  await withTransaction(async (session) => {
    await Result.bulkWrite(ops, { session, ordered: true });
    await recordAudit(
      {
        actorId: actor.id,
        action: 'results.save_draft',
        entityType: 'Assessment',
        entityId: assessment._id,
        after: { saved: ops.length },
        meta,
      },
      { session },
    );
  });
  const entered = await Result.countDocuments({ assessmentId });
  return { saved: ops.length, entered, enrolled: roster.length };
}

// ---------------------------------------------------------------------------
// Publish

function resultMessage(assessment, subjectName, result) {
  const title = `${assessment.name} (${subjectName})`;
  if (result.attendance !== RESULT_ATTENDANCE.PRESENT) {
    return `${title}: marked ${ATTENDANCE_LABEL[result.attendance].toLowerCase()}.`;
  }
  const parts = [];
  if (assessment.mode === ASSESSMENT_MODES.MARKS) {
    parts.push(`${result.marksObtained}/${assessment.totalMarks}`);
  }
  if (result.grade) parts.push(`grade ${result.grade}`);
  if (result.remarks) parts.push(`"${result.remarks}"`);
  return `${title}: ${parts.join(', ')}.`;
}

/** PATCH /api/assessments/:id/publish */
export async function publishAssessment(actor, id, meta = {}) {
  const assessment = await Assessment.findById(id).populate('subjectId', 'name');
  if (!assessment) throw ApiError.notFound('Assessment not found');
  await assertCanManage(actor, {
    classId: assessment.classId,
    sectionId: assessment.sectionId,
    subjectId: assessment.subjectId._id,
    sessionId: assessment.sessionId,
  });
  assertDraft(assessment);
  assertDateReached(assessment);

  const [roster, results, settings] = await Promise.all([
    rosterFor(assessment),
    Result.find({ assessmentId: id }),
    Settings.get(),
  ]);
  const byStudent = new Map(results.map((r) => [String(r.studentId), r]));
  const snapshot = snapshotScale(settings.gradingScale);

  // details.students lets the UI highlight the rows; errors[] keeps the readable messages.
  const incomplete = [];
  for (const p of roster) {
    const result = byStudent.get(String(p.userId._id));
    let problem = null;
    if (!result) problem = 'no entry';
    else if (missingPart(assessment, result))
      problem = `${missingPart(assessment, result)} missing`;
    else if (result.grade && !scaleGrades(snapshot).includes(result.grade)) {
      problem = `grade ${result.grade} is no longer in the grading scale`;
    }
    if (problem) {
      incomplete.push({
        studentId: String(p.userId._id),
        name: p.userId.name,
        rollNo: p.rollNo,
        problem,
      });
    }
  }
  if (incomplete.length) {
    throw ApiError.unprocessable(
      `Cannot publish: ${incomplete.length} student(s) need a complete entry.`,
      incomplete.map((s) => ({
        field: 'students',
        message: `${s.name} (roll ${s.rollNo}): ${s.problem}`,
      })),
      { code: ERROR_CODES.RESULTS_INCOMPLETE, details: { students: incomplete } },
    );
  }

  const rosterResults = roster.map((p) => byStudent.get(String(p.userId._id)));
  const outbox = await withTransaction(async (session) => {
    const txOutbox = createOutbox();
    // Final grades: non-overridden marks entries regraded with the snapshot.
    if (assessment.mode === ASSESSMENT_MODES.MARKS) {
      for (const r of rosterResults) {
        if (r.attendance === RESULT_ATTENDANCE.PRESENT && !r.gradeOverridden) {
          r.grade = gradeFor(r.percent, snapshot);
          await Result.updateOne({ _id: r._id }, { $set: { grade: r.grade } }, { session });
        }
      }
    }
    const now = new Date();
    const { modifiedCount } = await Assessment.updateOne(
      { _id: id, status: ASSESSMENT_STATUS.DRAFT },
      {
        $set: {
          status: ASSESSMENT_STATUS.PUBLISHED,
          publishedAt: now,
          publishedBy: actor.id,
          gradingScale: snapshot,
        },
      },
      { session },
    );
    if (!modifiedCount)
      throw ApiError.conflict('This assessment was just published by someone else.');

    // ONE notification per student.
    await createNotifications(
      rosterResults.map((r) => ({
        recipientId: r.studentId,
        type: 'result_published',
        title: `Result published: ${assessment.name}`,
        message: resultMessage(assessment, assessment.subjectId.name, r),
        data: { assessmentId: String(assessment._id), resultId: String(r._id) },
        relatedEntity: { kind: 'Result', id: r._id },
      })),
      { session, outbox: txOutbox },
    );

    const counts = { present: 0, absent: 0, excused: 0 };
    for (const r of rosterResults) counts[r.attendance] += 1;
    await recordAudit(
      {
        actorId: actor.id,
        action: 'assessment.publish',
        entityType: 'Assessment',
        entityId: assessment._id,
        after: { status: ASSESSMENT_STATUS.PUBLISHED, students: rosterResults.length, counts },
        meta,
      },
      { session },
    );
    return txOutbox;
  });
  await dispatchOutbox(outbox);
  return {
    published: true,
    students: rosterResults.length,
    assessment: await getAssessment(actor, id),
  };
}

// ---------------------------------------------------------------------------
// Published edits (teacher own / admin override)

const EDITABLE = ['attendance', 'marksObtained', 'grade', 'remarks'];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

/** PATCH /api/results/:id — published results only; reason required. */
export async function editPublishedResult(actor, resultId, { reason, ...changes }, meta = {}) {
  const result = await Result.findById(resultId);
  if (!result) throw ApiError.notFound('Result not found');
  const assessment = await Assessment.findById(result.assessmentId).populate('subjectId', 'name');
  if (assessment.status !== ASSESSMENT_STATUS.PUBLISHED) {
    throw ApiError.conflict(
      'This result is still a draft. Save drafts with PUT /api/results/:assessmentId.',
    );
  }
  await assertCanManage(actor, {
    classId: assessment.classId,
    sectionId: assessment.sectionId,
    subjectId: assessment.subjectId._id,
    sessionId: assessment.sessionId,
  });

  const current = result.toObject();
  // Start from the stored entry. A calculated grade is left out so it is recalculated (with the
  // assessment's snapshot); a manual override or a grade-mode grade is kept.
  const keepGrade = current.gradeOverridden || assessment.mode === ASSESSMENT_MODES.GRADE;
  const merged = {
    attendance: current.attendance,
    marksObtained: current.marksObtained,
    grade: keepGrade ? current.grade : undefined,
    remarks: current.remarks,
    ...pick(changes, EDITABLE),
  };
  // New marks without an explicit grade → recalculate and drop any override.
  if ('marksObtained' in changes && !('grade' in changes)) merged.grade = undefined;
  // Becoming absent/excused clears marks and grade unless the request names them (→ 422).
  if (changes.attendance && changes.attendance !== RESULT_ATTENDANCE.PRESENT) {
    merged.marksObtained = changes.marksObtained;
    merged.grade = changes.grade;
  }

  const { value, errors } = normalizeEntry(assessment, merged, assessment.gradingScale, 'result');
  if (errors.length) throw ApiError.unprocessable('Invalid result', errors);
  const missing = missingPart(assessment, value);
  if (missing) throw ApiError.invalidField(missing, `A present student needs ${missing}`);

  const beforeView = Object.fromEntries(Object.keys(value).map((k) => [k, current[k]]));
  const diff = diffChanges(beforeView, value);
  if (!Object.keys(diff.after).length) throw ApiError.badRequest('Nothing to change.');

  const isOverride = actor.role === ROLES.ADMIN;
  const outbox = await withTransaction(async (session) => {
    const txOutbox = createOutbox();
    const { $set, $unset } = setAndUnset({ ...value, updatedBy: actor.id });
    await Result.updateOne({ _id: result._id }, { $set, ...($unset && { $unset }) }, { session });
    await recordAudit(
      {
        actorId: actor.id,
        action: isOverride ? 'result.override' : 'result.update',
        entityType: 'Result',
        entityId: result._id,
        before: diff.before,
        after: { ...diff.after, reason, ...(isOverride && { override: true }) },
        meta,
      },
      { session },
    );
    await createNotifications(
      [
        {
          recipientId: result.studentId,
          type: 'result_updated',
          title: `Result updated: ${assessment.name}`,
          message: `Updated — ${resultMessage(assessment, assessment.subjectId.name, value)}`,
          data: { assessmentId: String(assessment._id), resultId: String(result._id) },
          relatedEntity: { kind: 'Result', id: result._id },
        },
      ],
      { session, outbox: txOutbox },
    );
    return txOutbox;
  });
  await dispatchOutbox(outbox);
  return Result.findById(result._id).lean();
}

// ---------------------------------------------------------------------------
// Student view — PUBLISHED ONLY, enforced here for every caller.

/** GET /api/results/student/:studentId */
export async function studentResults(studentId, { limit = 50, subjectId, assessmentId } = {}) {
  const activeSession = await requireActiveSession();
  const rows = await Result.aggregate([
    { $match: { studentId: new mongoose.Types.ObjectId(String(studentId)) } },
    {
      $lookup: {
        from: 'assessments',
        localField: 'assessmentId',
        foreignField: '_id',
        as: 'assessment',
      },
    },
    { $unwind: '$assessment' },
    {
      $match: {
        'assessment.status': ASSESSMENT_STATUS.PUBLISHED,
        'assessment.sessionId': activeSession._id,
        ...(subjectId && {
          'assessment.subjectId': new mongoose.Types.ObjectId(String(subjectId)),
        }),
        ...(assessmentId && {
          'assessment._id': new mongoose.Types.ObjectId(String(assessmentId)),
        }),
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: 'assessment.subjectId',
        foreignField: '_id',
        as: 'subject',
      },
    },
    { $sort: { 'assessment.publishedAt': -1, _id: -1 } },
    { $limit: limit },
    {
      $project: {
        attendance: 1,
        marksObtained: 1,
        percent: 1,
        grade: 1,
        remarks: 1,
        updatedAt: 1,
        assessment: {
          _id: '$assessment._id',
          name: '$assessment.name',
          type: '$assessment.type',
          mode: '$assessment.mode',
          totalMarks: '$assessment.totalMarks',
          date: '$assessment.date',
          publishedAt: '$assessment.publishedAt',
          // The scale saved when it was published: "What do the grades mean?"
          gradingScale: '$assessment.gradingScale',
        },
        subject: { $first: '$subject.name' },
        subjectId: '$assessment.subjectId',
      },
    },
  ]);
  return rows.map((r) => ({
    ...r,
    assessment: { ...r.assessment, date: toDateKey(r.assessment.date) },
  }));
}

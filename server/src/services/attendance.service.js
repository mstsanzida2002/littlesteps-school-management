/**
 * Taking attendance (FR-TCH-03/04) — "mark once per class-section per day":
 * a teacher submits one sheet for a class-section and date; the service creates one record per
 * enrolled student per subject the teacher has scheduled that weekday (or the explicitly chosen
 * `subjectIds` for unscheduled classes/substitutions), in ONE transaction with the notifications.
 */
import { ASSIGNMENT_STATUS, ATTENDANCE_STATUS, ERROR_CODES } from '../config/constants.js';
import { Attendance, Settings, TeacherAssignment } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { formatSchoolDateLong, toDateKey, todaySchoolDate, weekdayOf } from '../utils/date.js';
import { withTransaction } from '../utils/transaction.js';
import { evaluateLowAttendance, syncAbsenceNotification } from './attendanceAlerts.service.js';
import {
  assertMarkableDate,
  emailAllowedFor,
  enrolledStudents,
  subjectsToMark,
} from './attendanceRules.js';
import { recordAudit } from './audit.service.js';
import {
  classSectionLabel,
  requireActiveSession,
  requireSectionInClass,
} from './lookup.service.js';
import { createOutbox, dispatchOutbox } from './notification.service.js';

const isDuplicateKey = (err) =>
  err?.code === 11000 || err?.writeErrors?.some?.((e) => e.code === 11000);

function alreadyMarkedError(label, date, subjects, sampleStudentId) {
  const dateKey = toDateKey(date);
  return ApiError.conflict(
    `${label} is already marked for ${subjects.join(', ')} on ${formatSchoolDateLong(date)}. ` +
      'To change it, edit the records instead.',
    undefined,
    {
      code: ERROR_CODES.ALREADY_MARKED,
      details: {
        date: dateKey,
        subjects,
        edit: {
          record: 'PATCH /api/attendance/:id',
          studentDay: `PATCH /api/attendance/students/:studentId/days/${dateKey}`,
          sheet: `GET /api/attendance/class-sections/:classId/:sectionId/sheet?date=${dateKey}`,
        },
        ...(sampleStudentId && { sampleStudentId }),
      },
    },
  );
}

/**
 * POST /api/attendance
 * body: { classId, sectionId, date, defaultStatus?, entries[{ studentId, status }], subjectIds? }
 */
export async function markAttendance(actor, body, meta = {}) {
  const { classId, sectionId, date: dateKey, defaultStatus, entries = [], subjectIds } = body;
  const [settings, activeSession, { cls, section }] = await Promise.all([
    Settings.get(),
    requireActiveSession(),
    requireSectionInClass(classId, sectionId),
  ]);
  const label = classSectionLabel(cls, section);
  const date = assertMarkableDate({ dateKey, activeSession, settings, actor });

  const { subjects, timetableOverride, scheduledSubjectIds } = await subjectsToMark({
    teacherId: actor.id,
    classId,
    sectionId,
    sessionId: activeSession._id,
    date,
    subjectIds,
    label,
  });

  const students = await enrolledStudents({
    classId,
    sectionId,
    sessionId: activeSession._id,
    date,
  });
  if (!students.length) {
    throw ApiError.unprocessable(
      `No students are enrolled in ${label} on ${formatSchoolDateLong(date)}.`,
    );
  }

  // Resolve each student's status: explicit entries, else defaultStatus ("mark all present").
  const enrolled = new Map(students.map((p) => [String(p.userId._id), p]));
  const statusOf = new Map();
  const problems = [];
  for (const { studentId, status } of entries) {
    if (!enrolled.has(studentId)) {
      problems.push({
        field: 'entries',
        message: `Student ${studentId} is not enrolled in ${label}`,
      });
    } else if (statusOf.has(studentId)) {
      problems.push({ field: 'entries', message: `Student ${studentId} appears more than once` });
    } else {
      statusOf.set(studentId, status);
    }
  }
  if (!defaultStatus) {
    const missing = students.filter((p) => !statusOf.has(String(p.userId._id)));
    for (const p of missing) {
      problems.push({
        field: 'entries',
        message: `Missing status for ${p.userId.name} (roll ${p.rollNo})`,
      });
    }
  }
  if (problems.length) throw ApiError.unprocessable('Attendance sheet is incomplete', problems);

  const subjectIdList = subjects.map((s) => s._id);
  const existing = await Attendance.find({
    classId,
    sectionId,
    date,
    subjectId: { $in: subjectIdList },
  }).distinct('subjectId');
  if (existing.length) {
    const names = subjects
      .filter((s) => existing.some((id) => id.equals(s._id)))
      .map((s) => s.name);
    throw alreadyMarkedError(label, date, names);
  }

  const markedAt = new Date();
  const emailAllowed = emailAllowedFor(date);
  const rows = students.map((p) => ({
    studentId: p.userId._id,
    status: statusOf.get(String(p.userId._id)) ?? defaultStatus,
  }));
  const counts = { present: 0, absent: 0, late: 0 };
  for (const row of rows) counts[row.status] += 1;

  let outbox;
  try {
    outbox = await withTransaction(async (session) => {
      const txOutbox = createOutbox();
      await Attendance.bulkWrite(
        rows.flatMap((row) =>
          subjects.map((subject) => ({
            insertOne: {
              document: {
                studentId: row.studentId,
                classId,
                sectionId,
                subjectId: subject._id,
                sessionId: activeSession._id,
                teacherId: actor.id,
                date,
                status: row.status,
                markedAt,
              },
            },
          })),
        ),
        { session, ordered: true },
      );

      for (const row of rows.filter((r) => r.status === ATTENDANCE_STATUS.ABSENT)) {
        await syncAbsenceNotification({
          studentId: row.studentId,
          date,
          sessionId: activeSession._id,
          session,
          outbox: txOutbox,
          emailAllowed,
        });
      }
      await evaluateLowAttendance({
        studentIds: rows.map((r) => r.studentId),
        sessionId: activeSession._id,
        settings,
        session,
        outbox: txOutbox,
        emailAllowed,
      });

      await recordAudit(
        {
          actorId: actor.id,
          action: 'attendance.mark',
          entityType: 'Section',
          entityId: section._id,
          after: {
            classSection: label,
            date: toDateKey(date),
            subjects: subjects.map((s) => s.name),
            students: rows.length,
            records: rows.length * subjects.length,
            counts,
            timetableOverride,
            ...(timetableOverride && {
              scheduledSubjectIds,
              markedSubjectIds: subjectIdList.map(String),
            }),
          },
          meta,
        },
        { session },
      );
      return txOutbox;
    });
  } catch (err) {
    // Race with another submission: the unique index is the final guard.
    if (isDuplicateKey(err))
      throw alreadyMarkedError(
        label,
        date,
        subjects.map((s) => s.name),
      );
    throw err;
  }

  await dispatchOutbox(outbox);
  return {
    classSection: label,
    date: toDateKey(date),
    subjects: subjects.map((s) => ({ _id: s._id, name: s.name })),
    timetableOverride,
    students: rows.length,
    records: rows.length * subjects.length,
    counts,
  };
}

/**
 * GET /api/attendance/today — the teacher's class-sections scheduled today and whether their
 * subjects are marked: 'marked' | 'partial' | 'pending'.
 */
export async function todayStatus(actor) {
  const [settings, activeSession] = await Promise.all([Settings.get(), requireActiveSession()]);
  const today = todaySchoolDate();
  const weekday = weekdayOf(today);
  const base = { date: toDateKey(today), weekday };
  if (settings.weeklyOffDays.includes(weekday)) return { ...base, offDay: true, classSections: [] };

  const assignments = await TeacherAssignment.find({
    teacherId: actor.id,
    sessionId: activeSession._id,
    status: ASSIGNMENT_STATUS.ACTIVE,
    'schedule.day': weekday,
  })
    .populate('classId', 'name order')
    .populate('sectionId', 'name')
    .populate('subjectId', 'name code')
    .lean();

  const groups = new Map();
  for (const a of assignments) {
    const key = `${a.classId._id}:${a.sectionId._id}`;
    const slots = a.schedule
      .filter((s) => s.day === weekday)
      .sort((x, y) => x.startTime.localeCompare(y.startTime));
    if (!groups.has(key)) {
      groups.set(key, { class: a.classId, section: a.sectionId, subjects: [] });
    }
    groups
      .get(key)
      .subjects.push({ ...a.subjectId, startTime: slots[0].startTime, endTime: slots[0].endTime });
  }

  const classSections = await Promise.all(
    [...groups.values()].map(async (g) => {
      g.subjects.sort((x, y) => x.startTime.localeCompare(y.startTime));
      const marked = await Attendance.find({
        classId: g.class._id,
        sectionId: g.section._id,
        date: today,
        subjectId: { $in: g.subjects.map((s) => s._id) },
      }).distinct('subjectId');
      const markedSet = new Set(marked.map(String));
      const subjects = g.subjects.map((s) => ({ ...s, marked: markedSet.has(String(s._id)) }));
      const done = subjects.filter((s) => s.marked).length;
      return {
        classId: g.class._id,
        sectionId: g.section._id,
        label: classSectionLabel(g.class, g.section),
        status: done === 0 ? 'pending' : done === subjects.length ? 'marked' : 'partial',
        subjects,
        order: [g.class.order, subjects[0].startTime],
      };
    }),
  );
  classSections.sort((a, b) => a.order[1].localeCompare(b.order[1]) || a.order[0] - b.order[0]);
  return {
    ...base,
    offDay: false,
    classSections: classSections.map(({ order: _o, ...rest }) => rest),
  };
}

/**
 * GET /api/attendance/class-sections/:classId/:sectionId/sheet?date= — enrolled students, the
 * caller's subjects for that day (teachers) and any existing records.
 */
export async function attendanceSheet(actor, { classId, sectionId, date: dateKey }) {
  const [settings, activeSession, { cls, section }] = await Promise.all([
    Settings.get(),
    requireActiveSession(),
    requireSectionInClass(classId, sectionId),
  ]);
  const date = dateKey
    ? assertMarkableDate({ dateKey, activeSession, settings, actor: { role: 'admin' } })
    : todaySchoolDate();
  const students = await enrolledStudents({
    classId,
    sectionId,
    sessionId: activeSession._id,
    date,
  });
  const records = await Attendance.find({ classId, sectionId, date })
    .populate('subjectId', 'name')
    .populate('teacherId', 'name')
    .lean();

  let subjects = null;
  if (actor.role === 'teacher') {
    subjects = await subjectsToMark({
      teacherId: actor.id,
      classId,
      sectionId,
      sessionId: activeSession._id,
      date,
      label: classSectionLabel(cls, section),
    }).catch((err) => {
      if (err.code === ERROR_CODES.NO_SCHEDULED_SUBJECTS) return { subjects: [], ...err.details };
      throw err;
    });
  }

  return {
    classSection: classSectionLabel(cls, section),
    date: toDateKey(date),
    students: students.map((p) => ({
      studentId: p.userId._id,
      name: p.userId.name,
      rollNo: p.rollNo,
    })),
    subjects,
    records: records.map((r) => ({
      _id: r._id,
      studentId: r.studentId,
      subject: r.subjectId,
      teacher: r.teacherId,
      status: r.status,
    })),
  };
}

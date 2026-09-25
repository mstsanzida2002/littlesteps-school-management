/**
 * Editing attendance (FR-TCH-05/06) and the admin override (FR-ADM-09, attendance part).
 * ONE service for both roles:
 *  - teachers: only records of subjects in their active assignments for that class-section,
 *    within Settings.attendanceBackdateDays;
 *  - admins: any record, any date (audited as an override).
 * A reason is mandatory. Status change + AttendanceEditLog + AuditLog + notification updates +
 * low-attendance re-check happen in ONE transaction; real-time events go out after commit.
 */
import { ASSIGNMENT_STATUS, ATTENDANCE_STATUS, ROLES } from '../config/constants.js';
import { Attendance, AttendanceEditLog, Settings, TeacherAssignment } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { toDateKey, toSchoolDate } from '../utils/date.js';
import { withTransaction } from '../utils/transaction.js';
import {
  evaluateLowAttendance,
  notifyAttendanceCorrected,
  syncAbsenceNotification,
} from './attendanceAlerts.service.js';
import { assertWithinBackdateLimit, emailAllowedFor } from './attendanceRules.js';
import { recordAudit } from './audit.service.js';
import { createOutbox, dispatchOutbox, queueDataChanged } from './notification.service.js';

/** For a teacher, the set of "classId:sectionId:subjectId" they may edit. */
async function editableKeys(actor, records) {
  if (actor.role === ROLES.ADMIN) return null; // everything
  const assignments = await TeacherAssignment.find({
    teacherId: actor.id,
    status: ASSIGNMENT_STATUS.ACTIVE,
    sessionId: { $in: [...new Set(records.map((r) => String(r.sessionId)))] },
  })
    .select('classId sectionId subjectId')
    .lean();
  return new Set(assignments.map((a) => `${a.classId}:${a.sectionId}:${a.subjectId}`));
}

const recordKey = (r) => `${r.classId}:${r.sectionId}:${r.subjectId._id ?? r.subjectId}`;

async function applyEdits(actor, records, { status, reason }, { partialAllowed }, meta) {
  if (!records.length) throw ApiError.notFound('Attendance record not found');

  const allowed = await editableKeys(actor, records);
  let editable = records;
  if (allowed) {
    editable = records.filter((r) => allowed.has(recordKey(r)));
    if (!editable.length || (!partialAllowed && editable.length !== records.length)) {
      throw ApiError.forbidden(
        'You can only edit attendance for subjects you teach in this class.',
      );
    }
  }

  const settings = await Settings.get();
  for (const date of new Set(editable.map((r) => r.date.getTime()))) {
    assertWithinBackdateLimit({ date: new Date(date), settings, actor });
  }

  const changes = editable.filter((r) => r.status !== status);
  if (!changes.length) {
    throw ApiError.badRequest(`Nothing to change: the attendance is already "${status}".`);
  }

  const isOverride = actor.role === ROLES.ADMIN;
  const now = new Date();
  const outbox = await withTransaction(async (session) => {
    const txOutbox = createOutbox();

    for (const record of changes) {
      // Optimistic: only update if nobody changed it since we read it.
      const { modifiedCount } = await Attendance.updateOne(
        { _id: record._id, status: record.status },
        { $set: { status } },
        { session },
      );
      if (!modifiedCount) {
        throw ApiError.conflict(
          'This attendance was changed by someone else. Reload and try again.',
        );
      }
    }

    await AttendanceEditLog.create(
      changes.map((r) => ({
        attendanceId: r._id,
        studentId: r.studentId,
        oldStatus: r.status,
        newStatus: status,
        editedBy: actor.id,
        reason,
        editedAt: now,
      })),
      { session, ordered: true },
    );

    for (const r of changes) {
      await recordAudit(
        {
          actorId: actor.id,
          action: isOverride ? 'attendance.override' : 'attendance.update',
          entityType: 'Attendance',
          entityId: r._id,
          before: { status: r.status },
          after: {
            status,
            reason,
            studentId: r.studentId,
            subject: r.subjectId.name,
            date: toDateKey(r.date),
            ...(isOverride && { override: true }),
          },
          meta,
        },
        { session },
      );
    }

    // Per student-day: re-sync the grouped absence notification, notify corrections.
    const byStudentDay = new Map();
    for (const r of changes) {
      const key = `${r.studentId}:${r.date.getTime()}`;
      if (!byStudentDay.has(key))
        byStudentDay.set(key, {
          studentId: r.studentId,
          date: r.date,
          sessionId: r.sessionId,
          rows: [],
        });
      byStudentDay.get(key).rows.push(r);
    }
    for (const group of byStudentDay.values()) {
      await syncAbsenceNotification({
        studentId: group.studentId,
        date: group.date,
        sessionId: group.sessionId,
        session,
        outbox: txOutbox,
        emailAllowed: emailAllowedFor(group.date),
      });
      const corrected = group.rows
        .filter((r) => r.status === ATTENDANCE_STATUS.ABSENT)
        .map((r) => ({
          attendanceId: String(r._id),
          subject: r.subjectId.name,
          from: r.status,
          to: status,
        }));
      await notifyAttendanceCorrected({
        studentId: group.studentId,
        date: group.date,
        changes: corrected,
        session,
        outbox: txOutbox,
      });
    }

    const sessions = new Set(changes.map((r) => String(r.sessionId)));
    for (const sessionId of sessions) {
      await evaluateLowAttendance({
        studentIds: [
          ...new Set(
            changes
              .filter((r) => String(r.sessionId) === sessionId)
              .map((r) => String(r.studentId)),
          ),
        ],
        sessionId,
        settings,
        session,
        outbox: txOutbox,
        emailAllowed: changes.some((r) => emailAllowedFor(r.date)),
      });
    }
    for (const r of changes) {
      queueDataChanged(txOutbox, {
        scope: 'attendance',
        classId: r.classId,
        sectionId: r.sectionId,
        date: toDateKey(r.date),
      });
    }
    return txOutbox;
  });

  await dispatchOutbox(outbox);
  return {
    updated: changes.length,
    skipped: editable.length - changes.length,
    records: changes.map((r) => ({
      _id: r._id,
      subject: r.subjectId.name,
      date: toDateKey(r.date),
      from: r.status,
      to: status,
    })),
  };
}

/** PATCH /api/attendance/:id — one subject record. */
export async function editRecord(actor, id, body, meta) {
  const record = await Attendance.findById(id).populate('subjectId', 'name').lean();
  return applyEdits(actor, record ? [record] : [], body, { partialAllowed: false }, meta);
}

/**
 * PATCH /api/attendance/students/:studentId/days/:date — the whole day (optionally only
 * `subjectIds`). Teachers change only their own subjects' records.
 */
export async function editStudentDay(actor, studentId, dateKey, { subjectIds, ...body }, meta) {
  const filter = { studentId, date: toSchoolDate(dateKey) };
  if (subjectIds?.length) filter.subjectId = { $in: subjectIds };
  const records = await Attendance.find(filter).populate('subjectId', 'name').lean();
  return applyEdits(actor, records, body, { partialAllowed: true }, meta);
}

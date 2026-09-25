/**
 * Attendance-driven notifications (FR-NOT-01/02, FR-TCH-06, FR-STU-04). Always called inside the
 * attendance transaction with its `session` and `outbox`.
 *
 * - Absence: ONE notification per student per school day (dedupeKey), recomputed from the actual
 *   records after every mark/edit, so later absences update it and corrections shrink it; when no
 *   absence remains it is kept and marked `corrected`.
 * - Correction: one 'attendance_corrected' notification per edit and student listing the changes.
 * - Low attendance: fires only when a student crosses below the threshold (state stored on the
 *   StudentProfile), resets silently on recovery, needs MIN_RECORDED_DAYS_FOR_WARNING days.
 */
import mongoose from 'mongoose';

import { ATTENDANCE_STATUS } from '../config/constants.js';
import { Attendance, Notification, StudentProfile, User } from '../models/index.js';
import { formatSchoolDateLong, toDateKey } from '../utils/date.js';
import {
  attendanceRate,
  MIN_RECORDED_DAYS_FOR_WARNING,
  statusCounters,
} from './attendanceRules.js';
import { queueEmail, queueNotificationEvent } from './notification.service.js';

const STATUS_LABEL = { present: 'Present', absent: 'Absent', late: 'Late' };
export const absenceKey = (studentId, dateKey) => `absence:${studentId}:${dateKey}`;

/**
 * The grouped absence notification's fields for one student and day (also used by the seed, so
 * demo alerts read exactly like live ones).
 * absent: [{ attendanceId, subjectId, subject, teacher }]
 */
export function absenceNotificationFields({ studentName, date, absent }) {
  const when = formatSchoolDateLong(date);
  const list = absent.map((a) => (a.teacher ? `${a.subject} (${a.teacher})` : a.subject));
  return {
    type: 'absence',
    title: `Absent on ${when}`,
    message: `${studentName} was marked absent on ${when} in: ${list.join(', ')}.`,
    data: { date: toDateKey(date), subjects: absent, corrected: false },
    relatedEntity: { kind: 'Attendance', id: absent[0].attendanceId },
  };
}

const sameSubjects = (a = [], b = []) =>
  a.length === b.length && a.every((s, i) => s.attendanceId === b[i].attendanceId);

async function guardianEmail(studentId, sessionId, session) {
  const profile = await StudentProfile.findOne({ userId: studentId, sessionId })
    .select('guardian')
    .session(session)
    .lean();
  return profile?.guardian?.email;
}

/** Create/update/correct the day's grouped absence notification for one student. */
export async function syncAbsenceNotification({
  studentId,
  date,
  sessionId,
  session,
  outbox,
  emailAllowed,
}) {
  const dateKey = toDateKey(date);
  const when = formatSchoolDateLong(date);
  const records = await Attendance.find({ studentId, date })
    .populate('subjectId', 'name')
    .populate('teacherId', 'name')
    .sort({ markedAt: 1, _id: 1 })
    .session(session)
    .lean();
  const absent = records
    .filter((r) => r.status === ATTENDANCE_STATUS.ABSENT)
    .map((r) => ({
      attendanceId: String(r._id),
      subjectId: String(r.subjectId._id),
      subject: r.subjectId.name,
      teacher: r.teacherId?.name,
    }));

  const dedupeKey = absenceKey(studentId, dateKey);
  const existing = await Notification.findOne({ dedupeKey }).session(session);
  const student = await User.findById(studentId).select('name').session(session).lean();

  if (absent.length) {
    const fields = absenceNotificationFields({ studentName: student.name, date, absent });
    if (!existing) {
      const [created] = await Notification.create(
        [{ recipientId: studentId, dedupeKey, ...fields }],
        { session },
      );
      queueNotificationEvent(outbox, 'notification:new', created);
      // Email once per day: only when the day's absence notification is first created.
      if (emailAllowed) {
        queueEmail(outbox, {
          to: await guardianEmail(studentId, sessionId, session),
          subject: `LittleSteps: ${student.name} was absent on ${when}`,
          text: `${fields.message}\n\nIf this is a mistake, please contact the class teacher.`,
        });
      }
      return created;
    }
    if (!existing.data?.corrected && sameSubjects(existing.data?.subjects, absent)) return existing;
    existing.set({ ...fields, isRead: false, readAt: undefined });
    await existing.save({ session });
    queueNotificationEvent(outbox, 'notification:updated', existing);
    return existing;
  }

  if (existing && !existing.data?.corrected) {
    existing.set({
      title: `Absence corrected (${when})`,
      message: `All absences for ${student.name} on ${when} were corrected.`,
      data: { date: dateKey, subjects: [], corrected: true },
      isRead: false,
      readAt: undefined,
    });
    await existing.save({ session });
    queueNotificationEvent(outbox, 'notification:updated', existing);
  }
  return existing;
}

/** One 'attendance_corrected' notification listing the changes away from Absent. */
export async function notifyAttendanceCorrected({ studentId, date, changes, session, outbox }) {
  if (!changes.length) return null;
  const when = formatSchoolDateLong(date);
  const student = await User.findById(studentId).select('name').session(session).lean();
  const list = changes.map((c) => `${c.subject}: ${STATUS_LABEL[c.from]} → ${STATUS_LABEL[c.to]}`);
  const [notification] = await Notification.create(
    [
      {
        recipientId: studentId,
        type: 'attendance_corrected',
        title: `Attendance corrected (${when})`,
        message: `${student.name}'s attendance on ${when} was corrected: ${list.join('; ')}.`,
        data: { date: toDateKey(date), changes },
        relatedEntity: { kind: 'Attendance', id: changes[0].attendanceId },
      },
    ],
    { session },
  );
  queueNotificationEvent(outbox, 'notification:new', notification);
  return notification;
}

/**
 * Re-evaluate the low-attendance state of students (overall, active session) and warn on a
 * downward crossing only.
 */
export async function evaluateLowAttendance({
  studentIds,
  sessionId,
  settings,
  session,
  outbox,
  emailAllowed,
}) {
  if (!studentIds.length) return;
  const ids = studentIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const rows = await Attendance.aggregate([
    {
      $match: {
        studentId: { $in: ids },
        sessionId: new mongoose.Types.ObjectId(String(sessionId)),
      },
    },
    { $group: { _id: '$studentId', ...statusCounters, days: { $addToSet: '$date' } } },
    { $project: { total: 1, present: 1, late: 1, days: { $size: '$days' } } },
  ]).session(session);
  const stats = new Map(rows.map((r) => [String(r._id), r]));

  const profiles = await StudentProfile.find({ userId: { $in: ids }, sessionId })
    .populate('userId', 'name')
    .session(session);

  for (const profile of profiles) {
    const row = stats.get(String(profile.userId._id)) ?? { total: 0, days: 0 };
    const { percent } = attendanceRate(row, settings.lateCountsAsPresent);
    const below =
      row.days >= MIN_RECORDED_DAYS_FOR_WARNING &&
      percent !== null &&
      percent < settings.attendanceThreshold;
    const wasBelow = Boolean(profile.attendanceAlert?.belowThreshold);

    if (below && !wasBelow) {
      profile.attendanceAlert = { belowThreshold: true, since: new Date(), lastPercent: percent };
      await profile.save({ session });
      const name = profile.userId.name;
      const message =
        `${name}'s attendance is ${percent}%, below the school's required ` +
        `${settings.attendanceThreshold}%. Please make sure ${name} attends regularly.`;
      const [notification] = await Notification.create(
        [
          {
            recipientId: profile.userId._id,
            type: 'low_attendance',
            title: `Attendance below ${settings.attendanceThreshold}%`,
            message,
            data: { percent, threshold: settings.attendanceThreshold, recordedDays: row.days },
          },
        ],
        { session },
      );
      queueNotificationEvent(outbox, 'notification:new', notification);
      if (emailAllowed) {
        queueEmail(outbox, {
          to: profile.guardian?.email,
          subject: `LittleSteps: ${name}'s attendance is below ${settings.attendanceThreshold}%`,
          text: message,
        });
      }
    } else if (!below && wasBelow) {
      // Recovered: reset silently so a future drop warns again.
      profile.attendanceAlert = { belowThreshold: false, lastPercent: percent };
      await profile.save({ session });
    }
  }
}

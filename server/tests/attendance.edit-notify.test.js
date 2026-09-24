import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  Attendance,
  AttendanceEditLog,
  AuditLog,
  Notification,
  Settings,
  StudentProfile,
} from '../src/models/index.js';
import { setEmailProvider } from '../src/notifications/email.js';
import { evaluateLowAttendance } from '../src/services/attendanceAlerts.service.js';
import { createOutbox } from '../src/services/notification.service.js';
import { addDays, toDateKey } from '../src/utils/date.js';
import { withTransaction } from '../src/utils/transaction.js';
import {
  assign,
  createAttendanceSchool,
  insertAttendance,
  markBody,
  recentSchoolDays,
} from './helpers/attendance.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { apiAs } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(async () => {
  setEmailProvider(null);
  await clearTestDB();
});
afterAll(stopTestDB);

let school;
let farhana;
let nasrin;
let ayaan;
let sentEmails;
beforeEach(async () => {
  school = await createAttendanceSchool();
  farhana = apiAs(school.teacher);
  nasrin = apiAs(school.secondTeacher);
  [ayaan] = school.students;
  await assign(school, {
    subject: 'english',
    days: [school.weekday],
    start: '08:00',
    end: '08:30',
  });
  await assign(school, { subject: 'math', days: [school.weekday], start: '08:30', end: '09:00' });
  await assign(school, {
    teacher: school.secondTeacher,
    subject: 'drawing',
    days: [school.weekday],
    start: '10:00',
    end: '10:30',
  });
  sentEmails = [];
  setEmailProvider({ name: 'recorder', send: async (m) => sentEmails.push(m) });
});

const absentAyaan = (overrides = {}) =>
  markBody(school, {
    defaultStatus: 'present',
    entries: [{ studentId: String(ayaan._id), status: 'absent' }],
    ...overrides,
  });
const absences = () => Notification.find({ recipientId: ayaan._id, type: 'absence' }).lean();
const settle = () => new Promise((resolve) => setTimeout(resolve, 50)); // fire-and-forget emails

describe('grouped absence notification (one per student per day)', () => {
  it('lists every absent subject with its teacher', async () => {
    await farhana.post('/attendance', absentAyaan());
    const [n] = await absences();
    expect(await Notification.countDocuments({ recipientId: ayaan._id })).toBe(1);
    expect(n.data.subjects.map((s) => `${s.subject}/${s.teacher}`)).toEqual([
      'English/Farhana Akter',
      'Math/Farhana Akter',
    ]);
    expect(n.message).toMatch(
      /Ayaan Rahman was marked absent on .* in: English \(Farhana Akter\), Math \(Farhana Akter\)\./,
    );
    // Only students marked absent are notified.
    expect(await Notification.countDocuments({ recipientId: school.students[1]._id })).toBe(0);
  });

  it("a later absence the same day (another teacher's subject) updates the same notification", async () => {
    await farhana.post('/attendance', absentAyaan());
    const [first] = await absences();
    await Notification.updateOne({ _id: first._id }, { isRead: true });

    await nasrin.post('/attendance', absentAyaan());
    const all = await absences();
    expect(all).toHaveLength(1);
    expect(all[0]._id).toEqual(first._id);
    expect(all[0].data.subjects.map((s) => s.subject)).toEqual(['English', 'Math', 'Drawing']);
    expect(all[0].isRead).toBe(false); // new information → unread again
  });

  it('emails the guardian once per day, only on creation, only if they have an email', async () => {
    await farhana.post('/attendance', absentAyaan());
    await nasrin.post('/attendance', absentAyaan());
    await settle();
    const absenceEmails = sentEmails.filter((m) => /absent/.test(m.subject));
    expect(absenceEmails).toHaveLength(1);
    expect(absenceEmails[0].to).toBe('sharmin@example.com');

    // Nusrat's guardian has no email: in-app notification yes, email no.
    sentEmails.length = 0;
    const other = await farhana.patch(
      `/attendance/students/${school.students[1]._id}/days/${school.dayKey}`,
      { status: 'absent', reason: 'Left early' },
    );
    expect(other.status).toBe(200);
    await settle();
    expect(
      await Notification.countDocuments({ recipientId: school.students[1]._id, type: 'absence' }),
    ).toBe(1);
    expect(sentEmails).toHaveLength(0);
  });

  it('skips guardian emails for markings older than 1 day (in-app still created)', async () => {
    const older = recentSchoolDays(4).find(
      (d) => toDateKey(d) <= toDateKey(addDays(school.day, -2)),
    );
    await farhana.post(
      '/attendance',
      absentAyaan({ date: toDateKey(older), subjectIds: [String(school.subjects.english._id)] }),
    );
    await settle();
    expect(await absences()).toHaveLength(1);
    expect(sentEmails).toHaveLength(0);
  });
});

describe('editing and corrections', () => {
  beforeEach(async () => {
    await farhana.post('/attendance', absentAyaan());
  });

  const recordOf = (subject) =>
    Attendance.findOne({ studentId: ayaan._id, subjectId: school.subjects[subject]._id }).lean();

  it('absent → present: edit log + audit in one go, notification shrinks, correction sent', async () => {
    const english = await recordOf('english');
    const res = await farhana.patch(`/attendance/${english._id}`, {
      status: 'present',
      reason: 'Arrived after roll call',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      updated: 1,
      records: [{ from: 'absent', to: 'present' }],
    });

    const log = await AttendanceEditLog.findOne({ attendanceId: english._id }).lean();
    expect(log).toMatchObject({
      oldStatus: 'absent',
      newStatus: 'present',
      editedBy: school.teacher._id,
      reason: 'Arrived after roll call',
    });
    const audit = await AuditLog.findOne({
      action: 'attendance.update',
      entityId: english._id,
    }).lean();
    expect(audit.changes).toMatchObject({
      before: { status: 'absent' },
      after: { status: 'present', reason: 'Arrived after roll call' },
    });

    const [absence] = await absences();
    expect(absence.data.subjects.map((s) => s.subject)).toEqual(['Math']);
    expect(absence.data.corrected).toBe(false);
    const corrections = await Notification.find({
      recipientId: ayaan._id,
      type: 'attendance_corrected',
    }).lean();
    expect(corrections).toHaveLength(1);
    expect(corrections[0].message).toMatch(/English: Absent → Present/);
  });

  it('correcting the whole day marks the absence notification corrected', async () => {
    const res = await farhana.patch(`/attendance/students/${ayaan._id}/days/${school.dayKey}`, {
      status: 'present',
      reason: 'Was in the library corner',
    });
    expect(res.body.data.updated).toBe(2);
    const [absence] = await absences();
    expect(absence.data).toMatchObject({ corrected: true, subjects: [] });
    expect(absence.title).toMatch(/Absence corrected/);
    const [correction] = await Notification.find({ type: 'attendance_corrected' }).lean();
    expect(correction.data.changes.map((c) => c.subject)).toEqual(['English', 'Math']);
  });

  it('a reason is mandatory', async () => {
    const english = await recordOf('english');
    const res = await farhana.patch(`/attendance/${english._id}`, { status: 'present' });
    expect(res.status).toBe(422);
    const blank = await farhana.patch(`/attendance/${english._id}`, {
      status: 'present',
      reason: '  ',
    });
    expect(blank.status).toBe(422);
  });

  it("teachers can't edit other teachers' subjects; whole-day edits only touch their own", async () => {
    await nasrin.post('/attendance', absentAyaan());
    const drawing = await recordOf('drawing');
    expect(
      (await farhana.patch(`/attendance/${drawing._id}`, { status: 'present', reason: 'Oops' }))
        .status,
    ).toBe(403);

    const day = await farhana.patch(`/attendance/students/${ayaan._id}/days/${school.dayKey}`, {
      status: 'present',
      reason: 'Whole day correction',
    });
    expect(day.body.data.updated).toBe(2);
    expect((await recordOf('drawing')).status).toBe('absent');
  });

  it('admins can override any record (audited as an override); nothing-to-change is 400', async () => {
    const english = await recordOf('english');
    const admin = apiAs(school.admin);
    const res = await admin.patch(`/attendance/${english._id}`, {
      status: 'late',
      reason: 'Office record',
    });
    expect(res.status).toBe(200);
    const audit = await AuditLog.findOne({ action: 'attendance.override' }).lean();
    expect(audit.changes.after).toMatchObject({ status: 'late', override: true });

    const again = await admin.patch(`/attendance/${english._id}`, {
      status: 'late',
      reason: 'Again',
    });
    expect(again.status).toBe(400);
  });

  it('teachers are held to the backdate limit on edits; admins are not', async () => {
    const english = await recordOf('english');
    await Attendance.updateOne({ _id: english._id }, { date: addDays(school.day, -20) });
    const teacherRes = await farhana.patch(`/attendance/${english._id}`, {
      status: 'present',
      reason: 'Late fix',
    });
    expect(teacherRes.body.code).toBe('BACKDATE_LIMIT');
    const adminRes = await apiAs(school.admin).patch(`/attendance/${english._id}`, {
      status: 'present',
      reason: 'Late fix by office',
    });
    expect(adminRes.status).toBe(200);
  });
});

describe('low-attendance warning (crossings only)', () => {
  const pastDays = (n) => recentSchoolDays(n + 1).slice(1); // n school days before the marking day

  async function evaluate(students = [ayaan]) {
    const settings = await Settings.get();
    await withTransaction((session) =>
      evaluateLowAttendance({
        studentIds: students.map((s) => s._id),
        sessionId: school.session._id,
        settings,
        session,
        outbox: createOutbox(),
        emailAllowed: false,
      }),
    );
  }
  const warnings = () =>
    Notification.countDocuments({ recipientId: ayaan._id, type: 'low_attendance' });

  it('fires once when crossing below, not again while below, and again after recovering', async () => {
    await insertAttendance(
      school,
      pastDays(5).map((date) => ({ student: ayaan, date, status: 'absent' })),
    );
    // Marking today (present) → 1/6 = 16.7% < 75%: first crossing.
    await farhana.post(
      '/attendance',
      markBody(school, {
        defaultStatus: 'present',
        subjectIds: [String(school.subjects.english._id)],
      }),
    );
    expect(await warnings()).toBe(1);
    const profile = await StudentProfile.findOne({ userId: ayaan._id }).lean();
    expect(profile.attendanceAlert).toMatchObject({ belowThreshold: true, lastPercent: 16.7 });

    // Still below → no new warning.
    await evaluate();
    expect(await warnings()).toBe(1);

    // Recover: 16 more present → 17 attended / 22 recorded = 77.3% → flag resets silently.
    await insertAttendance(
      school,
      pastDays(8).flatMap((date) =>
        ['math', 'drawing'].map((subject) => ({
          student: ayaan,
          date,
          subject,
          status: 'present',
        })),
      ),
    );
    await evaluate();
    expect(await warnings()).toBe(1);
    expect(
      (await StudentProfile.findOne({ userId: ayaan._id })).attendanceAlert.belowThreshold,
    ).toBe(false);

    // Drop again → second warning.
    await Attendance.updateMany({ studentId: ayaan._id }, { status: 'absent' });
    await evaluate();
    expect(await warnings()).toBe(2);
  });

  it('needs at least 5 recorded school days', async () => {
    await insertAttendance(
      school,
      pastDays(4).map((date) => ({ student: ayaan, date, status: 'absent' })),
    );
    await evaluate();
    expect(await warnings()).toBe(0);
  });

  it('respects lateCountsAsPresent and the current threshold', async () => {
    await insertAttendance(
      school,
      pastDays(6).map((date) => ({ student: ayaan, date, status: 'late' })),
    );
    await evaluate(); // late counts as present → 100%
    expect(await warnings()).toBe(0);

    await Settings.updateOne({}, { lateCountsAsPresent: false });
    await evaluate(); // now 0%
    expect(await warnings()).toBe(1);

    const notification = await Notification.findOne({ type: 'low_attendance' }).lean();
    expect(notification.message).toMatch(/attendance is 0%, below the school's required 75%/);
  });
});

describe('notification API (own notifications only)', () => {
  beforeEach(async () => {
    await farhana.post('/attendance', absentAyaan());
  });

  it('lists, counts and marks read only for the owner', async () => {
    const student = apiAs(ayaan);
    const list = await student.get('/notifications');
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].dedupeKey).toBeUndefined();
    expect((await student.get('/notifications/unread-count')).body.data.count).toBe(1);

    const id = list.body.data[0]._id;
    // Someone else (another student, a teacher) cannot see or touch it.
    expect((await apiAs(school.students[1]).patch(`/notifications/${id}/read`)).status).toBe(404);
    expect((await apiAs(school.teacher).get('/notifications')).body.meta.total).toBe(0);

    expect((await student.patch(`/notifications/${id}/read`)).body.data.isRead).toBe(true);
    expect((await student.get('/notifications/unread-count')).body.data.count).toBe(0);
    expect((await student.get('/notifications?unread=true')).body.meta.total).toBe(0);
  });

  it('marks all as read', async () => {
    await farhana.patch(`/attendance/students/${ayaan._id}/days/${school.dayKey}`, {
      status: 'present',
      reason: 'Correction',
    });
    const student = apiAs(ayaan);
    expect((await student.get('/notifications/unread-count')).body.data.count).toBe(2);
    expect((await student.patch('/notifications/read-all')).body.data.updated).toBe(2);
    expect((await student.get('/notifications/unread-count')).body.data.count).toBe(0);
  });
});

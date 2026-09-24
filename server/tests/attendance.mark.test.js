import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Attendance, AuditLog, Settings, StudentProfile } from '../src/models/index.js';
import { addDays, toDateKey, todaySchoolDate } from '../src/utils/date.js';
import {
  assign,
  createAttendanceSchool,
  isSchoolDay,
  markBody,
  recentOffDay,
  recentSchoolDays,
} from './helpers/attendance.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { apiAs, guardian } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

const otherWeekday = (weekday) => (weekday === 'sunday' ? 'monday' : 'sunday');

let school;
let teacher;
beforeEach(async () => {
  school = await createAttendanceSchool();
  teacher = apiAs(school.teacher);
  // Farhana: English 08:00 and Math 08:30 on the marking weekday; Drawing only on another day.
  await assign(school, {
    subject: 'english',
    days: [school.weekday],
    start: '08:00',
    end: '08:30',
  });
  await assign(school, { subject: 'math', days: [school.weekday], start: '08:30', end: '09:00' });
  await assign(school, { subject: 'drawing', days: [otherWeekday(school.weekday)] });
});

describe('mark once per class-section per day', () => {
  it("creates one record per student for each of the teacher's scheduled subjects", async () => {
    // Another teacher's subject scheduled the same day must NOT be included.
    const nasrinDrawing = await assign(school, {
      teacher: school.secondTeacher,
      subject: 'drawing',
      days: [school.weekday],
      start: '09:00',
      end: '09:30',
    });
    // A student admitted after the marking day is not part of the sheet.
    const late = await createUser({ role: 'student', name: 'New Child' });
    await StudentProfile.create({
      userId: late._id,
      rollNo: 4,
      classId: school.classes.playgroup._id,
      sectionId: school.sections.pgA._id,
      sessionId: school.session._id,
      dateOfBirth: '2022-01-01',
      admissionDate: toDateKey(addDays(school.day, 1)),
      guardian,
    });

    const res = await teacher.post(
      '/attendance',
      markBody(school, {
        defaultStatus: 'present',
        entries: [{ studentId: String(school.students[1]._id), status: 'absent' }],
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      classSection: 'Playgroup-A',
      date: school.dayKey,
      students: 3,
      records: 6,
      timetableOverride: false,
      counts: { present: 2, absent: 1, late: 0 },
    });
    expect(res.body.data.subjects.map((s) => s.name)).toEqual(['English', 'Math']);

    const records = await Attendance.find({ date: school.day }).lean();
    expect(records).toHaveLength(6);
    expect(records.some((r) => r.subjectId.equals(nasrinDrawing.subjectId))).toBe(false);
    expect(records.some((r) => r.studentId.equals(late._id))).toBe(false);
    expect(records.filter((r) => r.status === 'absent').map((r) => String(r.studentId))).toEqual([
      String(school.students[1]._id),
      String(school.students[1]._id),
    ]);

    const audit = await AuditLog.findOne({ action: 'attendance.mark' }).lean();
    expect(audit.changes.after).toMatchObject({ records: 6, timetableOverride: false });
  });

  it('requires a status for every student unless defaultStatus is given', async () => {
    const res = await teacher.post(
      '/attendance',
      markBody(school, {
        entries: [{ studentId: String(school.students[0]._id), status: 'present' }],
      }),
    );
    expect(res.status).toBe(422);
    expect(res.body.errors.map((e) => e.message)).toEqual([
      'Missing status for Nusrat Jahan (roll 2)',
      'Missing status for Arham Hossain (roll 3)',
    ]);

    const stranger = await createUser({ role: 'student' });
    const unknown = await teacher.post(
      '/attendance',
      markBody(school, {
        defaultStatus: 'present',
        entries: [{ studentId: String(stranger._id), status: 'absent' }],
      }),
    );
    expect(unknown.status).toBe(422);
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it('a second submission for the same date returns 409 pointing to the edit flow', async () => {
    await teacher.post('/attendance', markBody(school, { defaultStatus: 'present' }));
    const again = await teacher.post('/attendance', markBody(school, { defaultStatus: 'absent' }));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_MARKED');
    expect(again.body.message).toMatch(/already marked for English, Math .* edit the records/);
    expect(again.body.details.edit.studentDay).toContain(school.dayKey);
    expect(await Attendance.countDocuments({ status: 'absent' })).toBe(0);
  });
});

describe('date rules', () => {
  it('rejects future dates', async () => {
    const res = await teacher.post(
      '/attendance',
      markBody(school, {
        date: toDateKey(addDays(todaySchoolDate(), 1)),
        defaultStatus: 'present',
      }),
    );
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('FUTURE_DATE');
  });

  it('rejects weekly off days', async () => {
    const off = recentOffDay();
    const res = await teacher.post(
      '/attendance',
      markBody(school, { date: toDateKey(off), defaultStatus: 'present' }),
    );
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('OFF_DAY');
    expect(res.body.message).toMatch(/weekly off day/);
  });

  it('rejects dates outside the active session', async () => {
    const res = await teacher.post(
      '/attendance',
      markBody(school, {
        date: toDateKey(addDays(todaySchoolDate(), -200)),
        defaultStatus: 'present',
      }),
    );
    expect(res.body.code).toBe('OUTSIDE_SESSION');
  });

  it('limits teachers to Settings.attendanceBackdateDays (default 7) and says an admin can help', async () => {
    // Date rules are checked before the timetable, so no schedule is needed for these dates.
    const old = recentSchoolDays(1, { from: addDays(todaySchoolDate(), -9) })[0];
    const res = await teacher.post(
      '/attendance',
      markBody(school, { date: toDateKey(old), defaultStatus: 'present' }),
    );
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BACKDATE_LIMIT');
    expect(res.body.message).toMatch(/last 7 days.*ask an admin/);

    // Tightening the setting applies immediately.
    await Settings.updateOne({}, { attendanceBackdateDays: 0 });
    const yesterdayish = recentSchoolDays(2)[1];
    const res2 = await teacher.post(
      '/attendance',
      markBody(school, { date: toDateKey(yesterdayish), defaultStatus: 'present' }),
    );
    expect(res2.body.code).toBe('BACKDATE_LIMIT');
  });
});

describe('timetable overrides and ownership', () => {
  it('422 NO_SCHEDULED_SUBJECTS suggests choosing subjects; subjectIds then marks exactly those', async () => {
    const drawingOnly = await createUser({ role: 'teacher' });
    await assign(school, {
      teacher: drawingOnly,
      subject: 'drawing',
      days: [otherWeekday(school.weekday)],
      start: '11:00',
      end: '11:30',
    });
    const api = apiAs(drawingOnly);

    const none = await api.post('/attendance', markBody(school, { defaultStatus: 'present' }));
    expect(none.status).toBe(422);
    expect(none.body.code).toBe('NO_SCHEDULED_SUBJECTS');
    expect(none.body.message).toMatch(/choose the subjects manually/);
    expect(none.body.details.availableSubjects.map((s) => s.name)).toEqual(['Drawing']);

    const manual = await api.post(
      '/attendance',
      markBody(school, {
        defaultStatus: 'present',
        subjectIds: [String(school.subjects.drawing._id)],
      }),
    );
    expect(manual.status).toBe(201);
    expect(manual.body.data).toMatchObject({ timetableOverride: true, records: 3 });
    const audit = await AuditLog.findOne({ action: 'attendance.mark' }).lean();
    expect(audit.changes.after).toMatchObject({
      timetableOverride: true,
      scheduledSubjectIds: [],
      markedSubjectIds: [String(school.subjects.drawing._id)],
    });
  });

  it("subjectIds may only contain the teacher's own subjects for that class-section", async () => {
    // Nasrin teaches Drawing in Playgroup-A; English there is Farhana's.
    await assign(school, { teacher: school.secondTeacher, subject: 'drawing', days: [] });
    const res = await apiAs(school.secondTeacher).post(
      '/attendance',
      markBody(school, {
        defaultStatus: 'present',
        subjectIds: [String(school.subjects.english._id)],
      }),
    );
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/only mark subjects you teach/);
  });

  it('a teacher cannot mark a class-section they are not assigned to', async () => {
    const res = await teacher.post(
      '/attendance',
      markBody(school, {
        classId: String(school.classes.nursery._id),
        sectionId: String(school.sections.nurA._id),
        defaultStatus: 'present',
      }),
    );
    expect(res.status).toBe(403);
    const sheet = await teacher.get(
      `/attendance/class-sections/${school.classes.nursery._id}/${school.sections.nurA._id}/sheet`,
    );
    expect(sheet.status).toBe(403);
  });

  it('admins cannot take attendance (they override via edits)', async () => {
    const res = await apiAs(school.admin).post(
      '/attendance',
      markBody(school, { defaultStatus: 'present' }),
    );
    expect(res.status).toBe(403);
  });
});

describe("today's status and admin hasSchedule flag", () => {
  it('reports pending then marked for today (or the off day)', async () => {
    const today = todaySchoolDate();
    const before = await teacher.get('/attendance/today');
    expect(before.status).toBe(200);
    if (!isSchoolDay(today)) {
      expect(before.body.data).toMatchObject({ offDay: true, classSections: [] });
      return;
    }
    // The fixture schedules subjects on the most recent school day, which is today here.
    expect(before.body.data.classSections).toEqual([
      expect.objectContaining({ label: 'Playgroup-A', status: 'pending' }),
    ]);
    await teacher.post('/attendance', markBody(school, { defaultStatus: 'present' }));
    const after = await teacher.get('/attendance/today');
    expect(after.body.data.classSections[0].status).toBe('marked');
  });

  it('flags assignments without a schedule', async () => {
    await assign(school, { teacher: school.secondTeacher, subject: 'english', days: [] });
    const res = await apiAs(school.admin).get(
      `/teacher-assignments?teacherId=${school.secondTeacher._id}`,
    );
    expect(res.body.data[0].hasSchedule).toBe(false);
    const own = await apiAs(school.admin).get(
      `/teacher-assignments?teacherId=${school.teacher._id}`,
    );
    expect(own.body.data.every((a) => a.hasSchedule)).toBe(true);
  });
});

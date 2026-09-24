import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Settings } from '../src/models/index.js';
import { toDateKey } from '../src/utils/date.js';
import {
  assign,
  createAttendanceSchool,
  insertAttendance,
  recentSchoolDays,
} from './helpers/attendance.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { apiAs } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let school;
let ayaan;
let nusrat;
let arham;
let days;
beforeEach(async () => {
  school = await createAttendanceSchool();
  [ayaan, nusrat, arham] = school.students;
  await assign(school, { subject: 'english', days: [school.weekday] });
  days = recentSchoolDays(2); // [d0 (latest), d1]
  // Ayaan: English present, absent, and Math late, present → 4 recorded.
  // Nusrat: English present on d0 only. Arham: nothing recorded.
  await insertAttendance(school, [
    { student: ayaan, subject: 'english', date: days[0], status: 'present' },
    { student: ayaan, subject: 'english', date: days[1], status: 'absent' },
    { student: ayaan, subject: 'math', date: days[0], status: 'late' },
    { student: ayaan, subject: 'math', date: days[1], status: 'present' },
    { student: nusrat, subject: 'english', date: days[0], status: 'present' },
  ]);
});

describe('student summary', () => {
  it('counts only recorded classes; late counts as present by default', async () => {
    const res = await apiAs(ayaan).get(`/attendance/student/${ayaan._id}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.data.overall).toEqual({
      total: 4,
      present: 2,
      absent: 1,
      late: 1,
      attended: 3,
      percent: 75,
    });
    const bySubject = Object.fromEntries(
      res.body.data.bySubject.map((s) => [s.subject.name, s.percent]),
    );
    expect(bySubject).toEqual({ English: 50, Math: 100 });
    expect(res.body.data.recordedDays).toBe(2);
    expect(res.body.data.byMonth.map((m) => m.month).every((m) => /^\d{4}-\d{2}$/.test(m))).toBe(
      true,
    );
    expect(res.body.data.byMonth.reduce((n, m) => n + m.total, 0)).toBe(4);
  });

  it('with lateCountsAsPresent off, late is not attended', async () => {
    await Settings.updateOne({}, { lateCountsAsPresent: false });
    const res = await apiAs(school.admin).get(`/attendance/student/${ayaan._id}/summary`);
    expect(res.body.data.overall).toMatchObject({ attended: 2, percent: 50 });
    const math = res.body.data.bySubject.find((s) => s.subject.name === 'Math');
    expect(math.percent).toBe(50);
  });

  it('zero recorded classes gives percent null (no division by zero)', async () => {
    const res = await apiAs(arham).get(`/attendance/student/${arham._id}/summary`);
    expect(res.body.data.overall).toEqual({
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      attended: 0,
      percent: null,
    });
    expect(res.body.data.bySubject).toEqual([]);
    expect(res.body.data.belowThreshold).toBe(false);
  });

  it('filters by date range', async () => {
    const res = await apiAs(ayaan).get(
      `/attendance/student/${ayaan._id}/summary?from=${toDateKey(days[0])}&to=${toDateKey(days[0])}`,
    );
    expect(res.body.data.overall).toMatchObject({ total: 2, percent: 100 });
    const history = await apiAs(ayaan).get(`/attendance/student/${ayaan._id}/history`);
    expect(history.body.data).toHaveLength(4);
    expect(history.body.data[0]).toMatchObject({ date: toDateKey(days[0]) });
  });
});

describe('class-section summary', () => {
  it('daily rates and a per-student table including students with no records', async () => {
    const res = await apiAs(school.teacher).get(
      `/attendance/class-sections/${school.classes.playgroup._id}/${school.sections.pgA._id}/summary`,
    );
    expect(res.status).toBe(200);
    const byDate = Object.fromEntries(res.body.data.daily.map((d) => [d.date, d]));
    expect(byDate[toDateKey(days[0])]).toMatchObject({ total: 3, attended: 3, percent: 100 });
    expect(byDate[toDateKey(days[1])]).toMatchObject({ total: 2, attended: 1, percent: 50 });

    expect(res.body.data.students.map((s) => [s.name, s.percent])).toEqual([
      ['Ayaan Rahman', 75],
      ['Nusrat Jahan', 100],
      ['Arham Hossain', null],
    ]);
  });

  it('filters by subject', async () => {
    const res = await apiAs(school.admin).get(
      `/attendance/class-sections/${school.classes.playgroup._id}/${school.sections.pgA._id}/summary?subjectId=${school.subjects.math._id}`,
    );
    expect(res.body.data.students[0]).toMatchObject({ total: 2, percent: 100 });
  });
});

describe('summary access', () => {
  it('student themselves, assigned teachers and admins only', async () => {
    const path = `/attendance/student/${ayaan._id}/summary`;
    expect((await apiAs(ayaan).get(path)).status).toBe(200);
    expect((await apiAs(nusrat).get(path)).status).toBe(403);
    expect((await apiAs(school.teacher).get(path)).status).toBe(200);
    expect((await apiAs(school.admin).get(path)).status).toBe(200);

    const stranger = await createUser({ role: 'teacher' });
    expect((await apiAs(stranger).get(path)).status).toBe(403);
    const classPath = `/attendance/class-sections/${school.classes.playgroup._id}/${school.sections.pgA._id}/summary`;
    expect((await apiAs(stranger).get(classPath)).status).toBe(403);
    expect((await apiAs(ayaan).get(classPath)).status).toBe(403);
  });
});

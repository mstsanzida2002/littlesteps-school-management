// The guardian's own profile (FR-STU-01) and StudentProfile.nickname (admin create/edit/approve).
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { StudentProfile } from '../src/models/index.js';
import { assign, createAttendanceSchool } from './helpers/attendance.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { apiAs, guardian } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let school;
let ayaan;
beforeEach(async () => {
  school = await createAttendanceSchool();
  [ayaan] = school.students;
});

describe('GET /api/students/me', () => {
  it('returns the child, the placement, the guardian and teachers by subject (names only)', async () => {
    await assign(school, { subject: 'english', days: [school.weekday] });
    await assign(school, {
      subject: 'english',
      teacher: school.secondTeacher,
      start: '09:00',
      end: '09:30',
    });
    await assign(school, {
      subject: 'math',
      teacher: school.secondTeacher,
      start: '10:00',
      end: '10:30',
    });
    await StudentProfile.updateOne({ userId: ayaan._id }, { nickname: 'Ayu' });

    const res = await apiAs(ayaan).get('/students/me');
    expect(res.status).toBe(200);
    const { student, session, guardian: onFile, teachers } = res.body.data;
    expect(student).toMatchObject({
      name: 'Ayaan Rahman',
      nickname: 'Ayu',
      classSection: 'Playgroup-A',
      rollNo: 1,
      dateOfBirth: '2022-01-01',
    });
    expect(session.name).toBe(school.session.name);
    expect(onFile).toMatchObject({
      name: 'Sharmin Akter',
      relation: 'mother',
      phone: '01712345678',
    });
    expect(teachers.map((t) => t.subject.name)).toEqual(['English', 'Math']);
    expect(teachers[0].teachers.map((t) => t.name)).toEqual(
      [school.teacher.name, 'Nasrin Sultana'].sort((a, b) => a.localeCompare(b)),
    );
    // Teachers' contact details never reach guardians.
    for (const t of teachers.flatMap((row) => row.teachers)) {
      expect(Object.keys(t).sort()).toEqual(['_id', 'name']);
    }
  });

  it('ended assignments are not listed', async () => {
    const assignment = await assign(school, { subject: 'english' });
    await assignment.updateOne({ status: 'ended' });
    expect((await apiAs(ayaan).get('/students/me')).body.data.teachers).toEqual([]);
  });

  it('is for students only: teachers and admins 403, signed out 401', async () => {
    expect((await apiAs(school.teacher).get('/students/me')).status).toBe(403);
    expect((await apiAs(school.admin).get('/students/me')).status).toBe(403);
    expect((await request(createApp()).get('/api/students/me')).status).toBe(401);
  });

  it('404 when the student is not enrolled in the active session', async () => {
    const pending = await createUser({ role: 'student', name: 'Not Placed' });
    expect((await apiAs(pending).get('/students/me')).status).toBe(404);
  });
});

describe('another child is never confirmed', () => {
  it("another student's attendance and results are 404 for a student, 403 for a teacher", async () => {
    const [, nusrat] = school.students;
    for (const path of [
      `/attendance/student/${nusrat._id}/summary`,
      `/attendance/student/${nusrat._id}/history`,
      `/results/student/${nusrat._id}`,
    ]) {
      const res = await apiAs(ayaan).get(path);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('Nusrat');
    }
    const outsider = await createUser({ role: 'teacher', name: 'Outside Teacher' });
    expect((await apiAs(outsider).get(`/results/student/${nusrat._id}`)).status).toBe(403);
  });
});

describe('nickname', () => {
  const create = (overrides = {}) => ({
    role: 'student',
    name: 'Tasnim Ara Oishi',
    username: 'tasnim.oishi',
    password: 'Start@1234',
    profile: {
      classId: String(school.classes.playgroup._id),
      sectionId: String(school.sections.pgA._id),
      dateOfBirth: '2022-03-04',
      guardian,
      ...overrides,
    },
  });

  it('admins set it on create (trimmed), change it and clear it', async () => {
    const admin = apiAs(school.admin);
    const res = await admin.post('/users', create({ nickname: '  Oishi ' }));
    expect(res.status).toBe(201);
    const id = res.body.data.user?._id ?? res.body.data._id;
    const nick = async () => (await StudentProfile.findOne({ userId: id }).lean()).nickname;
    expect(await nick()).toBe('Oishi');

    expect((await admin.patch(`/users/${id}`, { profile: { nickname: 'ওইশী' } })).status).toBe(200);
    expect(await nick()).toBe('ওইশী');
    expect((await admin.get(`/users/${id}`)).body.data.profile.nickname).toBe('ওইশী');

    expect((await admin.patch(`/users/${id}`, { profile: { nickname: '' } })).status).toBe(200);
    expect(await nick()).toBeUndefined();
    await admin.patch(`/users/${id}`, { profile: { nickname: 'Oishi' } });
    expect((await admin.patch(`/users/${id}`, { profile: { nickname: null } })).status).toBe(200);
    expect(await nick()).toBeUndefined();
  });

  it('an empty nickname on create means none', async () => {
    const res = await apiAs(school.admin).post('/users', create({ nickname: '' }));
    expect(res.status).toBe(201);
    const profile = await StudentProfile.findOne({
      userId: res.body.data.user?._id ?? res.body.data._id,
    }).lean();
    expect(profile).not.toHaveProperty('nickname');
  });

  it.each([
    ['too long', 'A'.repeat(31)],
    ['digits', 'Oishi2'],
    ['symbols', '<b>Oishi</b>'],
    ['blank', '   '],
  ])('rejects a nickname that is %s (422 on the field)', async (_label, nickname) => {
    const res = await apiAs(school.admin).post('/users', create({ nickname }));
    expect(res.status).toBe(422);
    expect(res.body.errors.map((e) => e.field)).toContain('profile.nickname');
  });

  it('teachers cannot set it (admin API only)', async () => {
    const res = await apiAs(school.teacher).patch(`/users/${ayaan._id}`, {
      profile: { nickname: 'Ayu' },
    });
    expect(res.status).toBe(403);
  });

  it('shows in the student summary for the child, an assigned teacher and admins', async () => {
    await assign(school, { subject: 'english', days: [school.weekday] });
    await StudentProfile.updateOne({ userId: ayaan._id }, { nickname: 'Ayu' });
    for (const user of [ayaan, school.teacher, school.admin]) {
      const res = await apiAs(user).get(`/attendance/student/${ayaan._id}/summary`);
      expect(res.body.data.student).toMatchObject({
        nickname: 'Ayu',
        admissionDate: expect.any(String),
      });
    }
  });
});

describe('session user', () => {
  it('students carry their nickname (null when unset) on /auth/me; staff do not', async () => {
    await StudentProfile.updateOne({ userId: ayaan._id }, { nickname: 'Ayu' });
    expect((await apiAs(ayaan).get('/auth/me')).body.data.user.nickname).toBe('Ayu');
    const [, nusrat] = school.students;
    expect((await apiAs(nusrat).get('/auth/me')).body.data.user.nickname).toBeNull();
    expect((await apiAs(school.teacher).get('/auth/me')).body.data.user).not.toHaveProperty(
      'nickname',
    );
  });
});

import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import {
  Attendance,
  AuditLog,
  RefreshToken,
  StudentProfile,
  TeacherAssignment,
  TeacherProfile,
  User,
} from '../src/models/index.js';
import { deleteUser, suspendUser } from '../src/services/user.service.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser, DEFAULT_PASSWORD, tokenFor } from './helpers/factories.js';
import { apiAs, createSchool, guardian } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let school;
let admin;
beforeEach(async () => {
  school = await createSchool();
  admin = apiAs(school.admin);
});

const studentBody = (overrides = {}, profile = {}) => ({
  role: 'student',
  name: 'Ayaan Rahman',
  username: 'pg-a-01',
  password: 'Start2026',
  ...overrides,
  profile: {
    classId: String(school.classes.playgroup._id),
    sectionId: String(school.sections.pgA._id),
    dateOfBirth: '2022-05-14',
    guardian,
    ...profile,
  },
});

describe('creating accounts', () => {
  it('creates a student with a StudentProfile in the active session and the next roll number', async () => {
    const res = await admin.post('/users', studentBody());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      username: 'pg-a-01',
      role: 'student',
      status: 'active',
      mustChangePassword: true,
      profile: { rollNo: 1, classId: { name: 'Playgroup' }, sectionId: { name: 'A' } },
    });
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.tokenVersion).toBeUndefined();

    const profile = await StudentProfile.findOne({ userId: res.body.data._id });
    expect(profile.sessionId.equals(school.session._id)).toBe(true);

    const log = await AuditLog.findOne({ action: 'user.create' }).lean();
    expect(log.changes.after).toMatchObject({ username: 'pg-a-01', role: 'student' });
    expect(JSON.stringify(log)).not.toMatch(/Start2026|passwordHash/);
  });

  it('creates a teacher with a TeacherProfile', async () => {
    const res = await admin.post('/users', {
      role: 'teacher',
      name: 'Nasrin Sultana',
      username: 'nasrin.sultana',
      email: 'nasrin@littlesteps.test',
      password: 'Start2026',
      profile: { employeeId: 't-010', qualification: 'B.Ed', joiningDate: '2024-01-10' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.profile).toMatchObject({ employeeId: 'T-010', qualification: 'B.Ed' });
    expect(await TeacherProfile.countDocuments({ userId: res.body.data._id })).toBe(1);
  });

  it('suggests highest+1 roll numbers and reports conflicts clearly', async () => {
    await admin.post('/users', studentBody({}, { rollNo: 1 }));
    await admin.post('/users', studentBody({ username: 'pg-a-04' }, { rollNo: 4 }));

    const next = await admin.get(
      `/users/next-roll?classId=${school.classes.playgroup._id}&sectionId=${school.sections.pgA._id}`,
    );
    expect(next.body.data).toEqual({ suggestedRollNo: 5, taken: [1, 4] });

    const conflict = await admin.post('/users', studentBody({ username: 'dup' }, { rollNo: 4 }));
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('ROLL_NUMBER_TAKEN');
    expect(conflict.body.message).toBe(
      'Roll 4 is already taken in Playgroup-A (2026). Next free: 5.',
    );
    // The transaction rolled back: no orphan account.
    expect(await User.exists({ username: 'dup' })).toBeNull();
  });

  it('rejects a section that is not part of the class', async () => {
    const res = await admin.post(
      '/users',
      studentBody({}, { sectionId: String(school.sections.nurA._id) }),
    );
    expect(res.status).toBe(422);
    expect(res.body.errors[0]).toMatchObject({ field: 'sectionId' });
  });

  it('forces the new user to change the admin-set password', async () => {
    const created = await admin.post('/users', studentBody());
    const login = await request(createApp())
      .post('/api/auth/login')
      .send({ identifier: 'pg-a-01', password: 'Start2026' });
    expect(login.status).toBe(200);
    expect(login.body.data.mustChangePassword).toBe(true);
    expect(created.body.data.mustChangePassword).toBe(true);
  });
});

describe('listing and editing', () => {
  beforeEach(async () => {
    await admin.post('/users', studentBody());
    await admin.post(
      '/users',
      studentBody(
        { name: 'Nusrat Jahan', username: 'pg-b-01' },
        { sectionId: String(school.sections.pgB._id) },
      ),
    );
  });

  it('paginates, filters, searches and sorts with a consistent meta block', async () => {
    const page1 = await admin.get('/users?role=student&limit=1&sort=name');
    expect(page1.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(page1.body.data[0].name).toBe('Ayaan Rahman');

    const bySection = await admin.get(`/users?sectionId=${school.sections.pgB._id}`);
    expect(bySection.body.data.map((u) => u.username)).toEqual(['pg-b-01']);

    const search = await admin.get('/users?search=nusrat');
    expect(search.body.data).toHaveLength(1);

    expect((await admin.get('/users?sort=passwordHash')).status).toBe(422);
    expect((await admin.get('/users?limit=500')).status).toBe(422);
  });

  it('edits account and profile fields and audits only the changes', async () => {
    const { _id } = await User.findOne({ username: 'pg-a-01' }).lean();
    const res = await admin.patch(`/users/${_id}`, {
      name: 'Ayaan R.',
      profile: { guardian: { ...guardian, phone: '01811112222' } },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.profile.guardian.phone).toBe('01811112222');

    const log = await AuditLog.findOne({ action: 'user.update' }).lean();
    expect(log.changes.before.name).toBe('Ayaan Rahman');
    expect(log.changes.after.name).toBe('Ayaan R.');
    expect(Object.keys(log.changes.after)).not.toContain('username');
  });

  it('moving to a taken roll number returns 409 and changes nothing', async () => {
    const { _id } = await User.findOne({ username: 'pg-b-01' }).lean();
    const res = await admin.patch(`/users/${_id}`, {
      name: 'Changed',
      profile: { sectionId: String(school.sections.pgA._id), rollNo: 1 },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ROLL_NUMBER_TAKEN');
    expect((await User.findById(_id)).name).toBe('Nusrat Jahan');
  });

  it('refuses role changes (no promote/demote)', async () => {
    const { _id } = await User.findOne({ username: 'pg-a-01' }).lean();
    const res = await admin.patch(`/users/${_id}`, { role: 'teacher' });
    expect(res.status).toBe(400);

    const self = await admin.patch(`/users/${school.admin._id}`, { role: 'teacher' });
    expect(self.status).toBe(400);
    expect((await User.findById(school.admin._id)).role).toBe('admin');
  });
});

describe('suspend and reactivate', () => {
  it('suspension ends existing sessions immediately and is audited', async () => {
    const student = await createUser({ role: 'student' });
    const token = await tokenFor(student);
    await RefreshToken.create({
      userId: student._id,
      tokenHash: 'x'.repeat(64),
      family: 'f',
      tokenVersion: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await admin.patch(`/users/${student._id}/suspend`, { reason: 'Fees overdue' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('suspended');

    const me = await request(createApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);
    expect(await RefreshToken.countDocuments({ userId: student._id, revokedAt: null })).toBe(0);

    const log = await AuditLog.findOne({ action: 'user.suspend' }).lean();
    expect(log.changes).toMatchObject({
      before: { status: 'active' },
      after: { status: 'suspended', reason: 'Fees overdue' },
    });

    const back = await admin.patch(`/users/${student._id}/reactivate`);
    expect(back.body.data.status).toBe('active');
  });

  it('an admin cannot suspend or delete their own account', async () => {
    const suspend = await admin.patch(`/users/${school.admin._id}/suspend`);
    expect(suspend.status).toBe(403);
    const del = await admin.delete(`/users/${school.admin._id}`);
    expect(del.status).toBe(403);
  });

  it('another admin can be suspended while one active admin remains', async () => {
    const second = await createUser({ role: 'admin' });
    expect((await admin.patch(`/users/${second._id}/suspend`)).status).toBe(200);
  });

  it('the last active admin can never be suspended or deleted (service-level guard)', async () => {
    // Via the API the actor is always a second active admin, so exercise the service directly.
    const someoneElse = { id: String(new mongoose.Types.ObjectId()), role: 'admin' };
    await expect(suspendUser(someoneElse, school.admin._id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'LAST_ADMIN',
    });
    await expect(deleteUser(someoneElse, school.admin._id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'LAST_ADMIN',
    });
  });
});

describe('delete', () => {
  it('hard-deletes an account without history, with its profile', async () => {
    const created = await admin.post('/users', studentBody());
    const id = created.body.data._id;
    const res = await admin.delete(`/users/${id}`);
    expect(res.status).toBe(200);
    expect(await User.exists({ _id: id })).toBeNull();
    expect(await StudentProfile.exists({ userId: id })).toBeNull();
    expect(await AuditLog.exists({ action: 'user.delete', entityId: id })).toBeTruthy();
  });

  it('refuses to delete a student with attendance and suggests suspension', async () => {
    const created = await admin.post('/users', studentBody());
    const id = created.body.data._id;
    await Attendance.create({
      studentId: id,
      classId: school.classes.playgroup._id,
      sectionId: school.sections.pgA._id,
      subjectId: school.subjects.english._id,
      sessionId: school.session._id,
      teacherId: school.teacher._id,
      date: '2026-09-20',
      status: 'present',
    });

    const res = await admin.delete(`/users/${id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USER_HAS_HISTORY');
    expect(res.body.message).toMatch(/1 attendance record .*Suspend the account instead/);
    expect(await User.exists({ _id: id })).toBeTruthy();
  });

  it('refuses to delete a teacher with an assignment', async () => {
    await TeacherAssignment.create({
      teacherId: school.teacher._id,
      classId: school.classes.playgroup._id,
      sectionId: school.sections.pgA._id,
      subjectId: school.subjects.english._id,
      sessionId: school.session._id,
    });
    const res = await admin.delete(`/users/${school.teacher._id}`);
    expect(res.status).toBe(409);
    expect(res.body.details.history).toEqual({ assignments: 1 });
  });
});

it('the default password in fixtures still works for a created user', async () => {
  const user = await createUser();
  const res = await request(createApp())
    .post('/api/auth/login')
    .send({ identifier: user.username, password: DEFAULT_PASSWORD });
  expect(res.status).toBe(200);
  expect(res.body.data.mustChangePassword).toBe(false);
});

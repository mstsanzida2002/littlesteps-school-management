import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { AuditLog, StudentProfile, User } from '../src/models/index.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { apiAs, createSchool, guardian } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let school;
let admin;
let pending;
beforeEach(async () => {
  school = await createSchool();
  admin = apiAs(school.admin);
  // Same shape as a real self-registration (e.g. rahim.test in littlesteps_dev).
  pending = await createUser({
    role: 'student',
    status: 'pending',
    username: 'rahim.test',
    password: 'Rahim2026',
    registration: { guardian, dateOfBirth: '2022-03-10', gender: 'male' },
  });
});

const approveBody = (overrides = {}) => ({
  classId: String(school.classes.playgroup._id),
  sectionId: String(school.sections.pgB._id),
  ...overrides,
});

describe('approve', () => {
  it('creates the StudentProfile from the registration and activates the account', async () => {
    const res = await admin.patch(`/users/${pending._id}/approve`, approveBody({ rollNo: 6 }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'active',
      profile: { rollNo: 6, classId: { name: 'Playgroup' }, sectionId: { name: 'B' } },
    });

    const user = await User.findById(pending._id).lean();
    expect(user.registration).toBeUndefined();
    const profile = await StudentProfile.findOne({ userId: pending._id }).lean();
    expect(profile.guardian).toMatchObject(guardian);
    expect(profile.dateOfBirth.toISOString()).toBe('2022-03-10T00:00:00.000Z');
    expect(profile.sessionId.equals(school.session._id)).toBe(true);

    const log = await AuditLog.findOne({ action: 'user.approve' }).lean();
    expect(log.changes.after).toMatchObject({ status: 'active', profile: { rollNo: 6 } });

    // The student chose their own password at registration: no forced change.
    const login = await request(createApp())
      .post('/api/auth/login')
      .send({ identifier: 'rahim.test', password: 'Rahim2026' });
    expect(login.status).toBe(200);
    expect(login.body.data.mustChangePassword).toBe(false);
  });

  it('rolls the whole approval back on a roll-number conflict', async () => {
    await admin.post('/users', {
      role: 'student',
      name: 'Existing Child',
      username: 'pg-b-06',
      password: 'Start2026',
      profile: { ...approveBody(), rollNo: 6, dateOfBirth: '2022-01-01', guardian },
    });

    const res = await admin.patch(`/users/${pending._id}/approve`, approveBody({ rollNo: 6 }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ROLL_NUMBER_TAKEN');
    expect(res.body.message).toBe('Roll 6 is already taken in Playgroup-B (2026). Next free: 7.');

    const user = await User.findById(pending._id).lean();
    expect(user.status).toBe('pending');
    expect(user.registration.guardian.name).toBe(guardian.name);
    expect(await StudentProfile.exists({ userId: pending._id })).toBeNull();
    expect(await AuditLog.exists({ action: 'user.approve' })).toBeNull();
  });

  it('is atomic: a failure after the profile is written leaves no profile behind', async () => {
    // Corrupt the stored account (bypassing validation) so saving it fails *after* the
    // StudentProfile insert inside the approval.
    await User.collection.updateOne({ _id: pending._id }, { $set: { name: 'x'.repeat(150) } });

    const res = await admin.patch(`/users/${pending._id}/approve`, approveBody({ rollNo: 3 }));
    expect(res.status).toBe(422);
    expect(await StudentProfile.exists({ userId: pending._id })).toBeNull();
    expect((await User.findById(pending._id).lean()).status).toBe('pending');
  });

  it('uses the next free roll number when none is given', async () => {
    const res = await admin.patch(`/users/${pending._id}/approve`, approveBody());
    expect(res.body.data.profile.rollNo).toBe(1);
  });

  it('requires a date of birth when the registration has none', async () => {
    await User.updateOne({ _id: pending._id }, { $unset: { 'registration.dateOfBirth': 1 } });
    const missing = await admin.patch(`/users/${pending._id}/approve`, approveBody());
    expect(missing.status).toBe(422);
    expect(missing.body.errors[0].field).toBe('dateOfBirth');

    const ok = await admin.patch(
      `/users/${pending._id}/approve`,
      approveBody({ dateOfBirth: '2022-04-01' }),
    );
    expect(ok.status).toBe(200);
  });

  it('only pending registrations can be approved, into a section of that class', async () => {
    const wrongSection = await admin.patch(
      `/users/${pending._id}/approve`,
      approveBody({ sectionId: String(school.sections.nurA._id) }),
    );
    expect(wrongSection.status).toBe(422);

    await admin.patch(`/users/${pending._id}/approve`, approveBody());
    const again = await admin.patch(`/users/${pending._id}/approve`, approveBody());
    expect(again.status).toBe(409);
  });
});

describe('reject', () => {
  it('marks the account rejected with a reason and blocks sign-in', async () => {
    const res = await admin.patch(`/users/${pending._id}/reject`, {
      reason: 'Not a LittleSteps family',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.registration.review).toMatchObject({ reason: 'Not a LittleSteps family' });

    const login = await request(createApp())
      .post('/api/auth/login')
      .send({ identifier: 'rahim.test', password: 'Rahim2026' });
    expect(login.status).toBe(403);
    expect(login.body.message).toMatch(/not approved/);

    expect(await AuditLog.exists({ action: 'user.reject', entityId: pending._id })).toBeTruthy();
  });

  it('requires a reason', async () => {
    expect((await admin.patch(`/users/${pending._id}/reject`, {})).status).toBe(422);
  });
});

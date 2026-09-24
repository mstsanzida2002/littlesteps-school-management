import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { AuditLog, RefreshToken, User } from '../src/models/index.js';
import { INVALID_CREDENTIALS } from '../src/services/auth.service.js';
import {
  hashToken,
  invalidateUserSessions,
  ROTATION_GRACE_MS,
} from '../src/services/token.service.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser, DEFAULT_PASSWORD, refreshCookieFrom } from './helpers/factories.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

// A fresh app per test = fresh rate-limit counters.
let app;
beforeEach(() => {
  app = createApp({ selfRegistrationEnabled: true });
});

const login = (identifier, password = DEFAULT_PASSWORD) =>
  request(app).post('/api/auth/login').send({ identifier, password });
const refresh = (cookie) => {
  const req = request(app).post('/api/auth/refresh');
  return cookie ? req.set('Cookie', cookie) : req;
};
const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
const cookieValue = (cookie) => cookie.split('=')[1];

async function signIn(user, password = DEFAULT_PASSWORD) {
  const res = await login(user.username, password);
  expect(res.status).toBe(200);
  return { token: res.body.data.accessToken, cookie: refreshCookieFrom(res) };
}

// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  it('signs in by username and sets a secure refresh cookie', async () => {
    const user = await createUser({ role: 'teacher' });
    const res = await login(user.username);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ username: user.username, role: 'teacher' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.tokenVersion).toBeUndefined();

    const setCookie = res.headers['set-cookie'].find((c) => c.startsWith('ls_rt='));
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Path=\/api\/auth/);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Expires=/);
    expect(setCookie).not.toMatch(/Secure/i); // secure only in production

    expect((await User.findById(user._id)).lastLoginAt).toBeInstanceOf(Date);
  });

  it('signs in by email, case-insensitively', async () => {
    await createUser({ email: 'farhana@littlesteps.test' });
    expect((await login('  Farhana@LittleSteps.TEST ')).status).toBe(200);
  });

  it('returns identical responses for a wrong username and a wrong password', async () => {
    const user = await createUser();
    const wrongUser = await login('no-such-user', DEFAULT_PASSWORD);
    const wrongPassword = await login(user.username, 'Wrong-pass1');

    expect(wrongUser.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(wrongUser.body).toEqual(wrongPassword.body);
    expect(wrongUser.body).toEqual({ success: false, message: INVALID_CREDENTIALS });
    expect(refreshCookieFrom(wrongUser)).toBeUndefined();
  });

  it('reveals Pending/Suspended status only after the password is correct', async () => {
    const pending = await createUser({ status: 'pending' });
    const suspended = await createUser({ status: 'suspended' });

    const pendingOk = await login(pending.username);
    expect(pendingOk.status).toBe(403);
    expect(pendingOk.body.message).toMatch(/awaiting admin approval/);
    expect(refreshCookieFrom(pendingOk)).toBeUndefined();

    const suspendedOk = await login(suspended.username);
    expect(suspendedOk.status).toBe(403);
    expect(suspendedOk.body.message).toMatch(/suspended/);

    const pendingWrong = await login(pending.username, 'Wrong-pass1');
    expect(pendingWrong.status).toBe(401);
    expect(pendingWrong.body.message).toBe(INVALID_CREDENTIALS);
  });

  it('rejects a malformed body with 422', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '' });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token and 401 without one', async () => {
    const user = await createUser();
    const { token } = await signIn(user);

    const ok = await me(token);
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.username).toBe(user.username);

    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await me('not-a-jwt')).status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token on every use', async () => {
    const user = await createUser();
    const { cookie: first } = await signIn(user);

    const res = await refresh(first);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.username).toBe(user.username);

    const second = refreshCookieFrom(res);
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(2);
  });

  it('multi-tab race: within the grace window the old token fails harmlessly and the new one still refreshes', async () => {
    const user = await createUser();
    const { cookie: first } = await signIn(user);
    const second = refreshCookieFrom(await refresh(first)); // tab A rotates

    // Tab B lost the race and presents the old token.
    const lost = await refresh(first);
    expect(lost.status).toBe(401);
    // The client retries only on this code.
    expect(lost.body.code).toBe('TOKEN_ROTATED');
    // The cookie must not be cleared: the browser may already hold tab A's newer token.
    expect(refreshCookieFrom(lost)).toBeUndefined();

    // The new token is untouched and keeps working.
    const retry = await refresh(second);
    expect(retry.status).toBe(200);
    expect(await RefreshToken.countDocuments({ revokedReason: 'reuse_detected' })).toBe(0);
  });

  it('reuse of a rotated token after the grace window revokes the whole family', async () => {
    const user = await createUser();
    const { cookie: first } = await signIn(user);
    const second = refreshCookieFrom(await refresh(first));

    // Pretend the rotation happened longer ago than the grace window.
    await RefreshToken.updateOne(
      { tokenHash: hashToken(cookieValue(first)) },
      { $set: { revokedAt: new Date(Date.now() - ROTATION_GRACE_MS - 5_000) } },
    );

    const reused = await refresh(first);
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe('SESSION_INVALID');
    expect(refreshCookieFrom(reused)).toBe('ls_rt='); // cleared

    // The legitimate newest token is now dead too.
    expect((await refresh(second)).status).toBe(401);
    const live = await RefreshToken.countDocuments({ userId: user._id, revokedAt: null });
    expect(live).toBe(0);
    expect(await RefreshToken.countDocuments({ revokedReason: 'reuse_detected' })).toBe(1);
  });

  it('rejects a missing, unknown, or expired token', async () => {
    const user = await createUser();
    const { cookie } = await signIn(user);

    const none = await refresh();
    expect(none.status).toBe(401);
    expect(none.body.code).toBe('NO_SESSION');
    const garbage = await refresh('ls_rt=garbage');
    expect(garbage.status).toBe(401);
    expect(garbage.body.code).toBe('SESSION_INVALID');

    await RefreshToken.updateOne(
      { tokenHash: hashToken(cookieValue(cookie)) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect((await refresh(cookie)).status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the current refresh token and clears the cookie', async () => {
    const user = await createUser();
    const { cookie } = await signIn(user);

    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(refreshCookieFrom(res)).toBe('ls_rt=');
    expect((await refresh(cookie)).status).toBe(401);
  });

  it('succeeds without a cookie (idempotent)', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(200);
  });
});

describe('session invalidation', () => {
  it('suspension makes an existing access token fail immediately and kills refresh', async () => {
    const user = await createUser();
    const { token, cookie } = await signIn(user);
    expect((await me(token)).status).toBe(200);

    await User.updateOne({ _id: user._id }, { status: 'suspended' });
    await invalidateUserSessions(user._id, 'suspended');

    expect((await me(token)).status).toBe(401);
    expect((await refresh(cookie)).status).toBe(401);
  });

  it('a tokenVersion bump alone invalidates existing access tokens', async () => {
    const user = await createUser();
    const { token } = await signIn(user);
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
    expect((await me(token)).status).toBe(401);
  });

  it('changing the password ends other sessions and keeps this device signed in', async () => {
    const user = await createUser();
    const other = await signIn(user); // e.g. another phone
    const current = await signIn(user);

    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${current.token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'NewPassw0rd' });
    expect(res.status).toBe(200);
    const fresh = { token: res.body.data.accessToken, cookie: refreshCookieFrom(res) };

    expect((await me(current.token)).status).toBe(401);
    expect((await me(other.token)).status).toBe(401);
    expect((await refresh(other.cookie)).status).toBe(401);
    expect((await me(fresh.token)).status).toBe(200);
    expect((await refresh(fresh.cookie)).status).toBe(200);

    expect((await login(user.username, DEFAULT_PASSWORD)).status).toBe(401);
    expect((await login(user.username, 'NewPassw0rd')).status).toBe(200);
  });

  it('change password requires the correct current password and a new one', async () => {
    const user = await createUser();
    const { token } = await signIn(user);
    const change = (body) =>
      request(app).patch('/api/auth/password').set('Authorization', `Bearer ${token}`).send(body);

    const wrong = await change({ currentPassword: 'Wrong-pass1', newPassword: 'NewPassw0rd' });
    expect(wrong.status).toBe(400);
    const same = await change({ currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD });
    expect(same.status).toBe(400);
    expect((await me(token)).status).toBe(200); // failed attempts don't end the session
  });
});

describe('PATCH /api/users/:id/password (admin reset)', () => {
  it('resets the password, ends the user sessions, and writes an audit log', async () => {
    const admin = await createUser({ role: 'admin' });
    const student = await createUser();
    const adminSession = await signIn(admin);
    const studentSession = await signIn(student);

    const res = await request(app)
      .patch(`/api/users/${student._id}/password`)
      .set('Authorization', `Bearer ${adminSession.token}`)
      .send({ newPassword: 'Reset1234' });
    expect(res.status).toBe(200);

    expect((await me(studentSession.token)).status).toBe(401);
    expect((await refresh(studentSession.cookie)).status).toBe(401);
    expect((await login(student.username, 'Reset1234')).status).toBe(200);

    const log = await AuditLog.findOne({ action: 'user.password_reset' }).lean();
    expect(log).toMatchObject({ actorId: admin._id, entityType: 'User', entityId: student._id });
    expect(JSON.stringify(log)).not.toMatch(/Reset1234|\$2[aby]\$/);
  });

  it('is admin-only and validates input', async () => {
    const teacher = await createUser({ role: 'teacher' });
    const admin = await createUser({ role: 'admin' });
    const { token: teacherToken } = await signIn(teacher);
    const { token: adminToken } = await signIn(admin);

    const asTeacher = await request(app)
      .patch(`/api/users/${admin._id}/password`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ newPassword: 'Reset1234' });
    expect(asTeacher.status).toBe(403);

    const badId = await request(app)
      .patch('/api/users/not-an-id/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'Reset1234' });
    expect(badId.status).toBe(422);

    const missing = await request(app)
      .patch('/api/users/64b000000000000000000000/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'Reset1234' });
    expect(missing.status).toBe(404);
  });
});

describe('password policy', () => {
  async function tryChange(newPassword) {
    const user = await createUser();
    const { token } = await signIn(user);
    return request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword });
  }

  it.each([
    ['too short', 'abc123'],
    ['no number', 'abcdefghij'],
    ['no letter', '1234567890'],
  ])('rejects a password with %s', async (_label, password) => {
    expect((await tryChange(password)).status).toBe(422);
  });

  it('limits passwords to 72 bytes, not 72 characters (Bangla is 3 bytes per letter)', async () => {
    const longBangla = `${'বাংলাদেশ'.repeat(3)}১`; // 25 characters, 73 bytes
    expect(longBangla.length).toBeLessThan(72);
    expect(Buffer.byteLength(longBangla, 'utf8')).toBeGreaterThan(72);

    const res = await tryChange(longBangla);
    expect(res.status).toBe(422);
    expect(res.body.errors[0].message).toMatch(/72 bytes/);
  });

  it('accepts a Bangla password within 72 bytes (Bangla digits count as numbers)', async () => {
    expect((await tryChange('বাংলাদেশ১২৩')).status).toBe(200);
  });
});

describe('login rate limiting', () => {
  it('blocks the 6th failed attempt for the same IP + identifier', async () => {
    const user = await createUser();
    for (let i = 0; i < 5; i += 1) {
      expect((await login(user.username, 'Wrong-pass1')).status).toBe(401);
    }
    const sixth = await login(user.username, 'Wrong-pass1');
    expect(sixth.status).toBe(429);
    expect(sixth.body.success).toBe(false);

    // Even the right password is blocked for this identifier until the window passes…
    expect((await login(user.username)).status).toBe(429);
    // …but other identifiers from the same IP are not.
    const other = await createUser();
    expect((await login(other.username)).status).toBe(200);
  });
});

describe('POST /api/auth/register', () => {
  const registration = (overrides = {}) => ({
    name: 'Ayaan Rahman',
    username: 'ayaan.r',
    password: 'Ayaan2026',
    email: '',
    guardian: { name: 'Sharmin Akter', relation: 'mother', phone: '01712345678' },
    dateOfBirth: '2022-05-14',
    gender: 'male',
    ...overrides,
  });

  it('creates a Pending student and an audit log entry; login waits for approval', async () => {
    const res = await request(app).post('/api/auth/register').send(registration());
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ username: 'ayaan.r', status: 'pending' });
    expect(refreshCookieFrom(res)).toBeUndefined();

    const user = await User.findOne({ username: 'ayaan.r' }).lean();
    expect(user).toMatchObject({ role: 'student', status: 'pending' });
    expect(user.email).toBeUndefined();
    expect(user.registration.guardian.name).toBe('Sharmin Akter');
    expect(user.registration.dateOfBirth.toISOString()).toBe('2022-05-14T00:00:00.000Z');
    expect(await AuditLog.exists({ action: 'user.register', entityId: user._id })).toBeTruthy();

    const attempt = await login('ayaan.r', 'Ayaan2026');
    expect(attempt.status).toBe(403);
    expect(attempt.body.message).toMatch(/awaiting admin approval/);
  });

  it('rejects duplicate usernames and weak passwords', async () => {
    await request(app).post('/api/auth/register').send(registration());
    expect((await request(app).post('/api/auth/register').send(registration())).status).toBe(409);
    const weak = registration({ username: 'someone.else', password: 'short' });
    expect((await request(app).post('/api/auth/register').send(weak)).status).toBe(422);
  });

  it('returns 404 when self-registration is disabled', async () => {
    const disabled = createApp({ selfRegistrationEnabled: false });
    const res = await request(disabled).post('/api/auth/register').send(registration());
    expect(res.status).toBe(404);
  });
});

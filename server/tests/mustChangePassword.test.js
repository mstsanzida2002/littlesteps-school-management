import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { User } from '../src/models/index.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser, refreshCookieFrom } from './helpers/factories.js';
import { apiAs, createSchool } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let app;
let school;
beforeEach(async () => {
  app = createApp();
  school = await createSchool();
});

async function signIn(identifier, password) {
  const res = await request(app).post('/api/auth/login').send({ identifier, password });
  return { res, token: res.body.data?.accessToken, cookie: refreshCookieFrom(res) };
}

describe('mustChangePassword', () => {
  let newAdmin;
  beforeEach(async () => {
    // An admin creating another admin: exercises a route that normally works for admins.
    const created = await apiAs(school.admin, app).post('/users', {
      role: 'admin',
      name: 'Office Admin',
      username: 'office',
      password: 'Temp2026x',
    });
    expect(created.status).toBe(201);
    newAdmin = created.body.data;
  });

  it('login and refresh succeed but report mustChangePassword', async () => {
    const { res, cookie } = await signIn('office', 'Temp2026x');
    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(true);
    expect(res.body.data.user.mustChangePassword).toBe(true);

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.mustChangePassword).toBe(true);
  });

  it('every other API route returns 403 PASSWORD_CHANGE_REQUIRED until the password changes', async () => {
    const { token } = await signIn('office', 'Temp2026x');
    const auth = (req) => req.set('Authorization', `Bearer ${token}`);

    const blocked = await auth(request(app).get('/api/users'));
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await auth(request(app).get('/api/settings'))).body.code).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );

    // Allowed: /auth/me and /auth/password (and refresh/logout, which need no access token).
    expect((await auth(request(app).get('/api/auth/me'))).status).toBe(200);
    const changed = await auth(request(app).patch('/api/auth/password')).send({
      currentPassword: 'Temp2026x',
      newPassword: 'MyOwnPass1',
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data.mustChangePassword).toBe(false);

    const fresh = changed.body.data.accessToken;
    const ok = await request(app).get('/api/users').set('Authorization', `Bearer ${fresh}`);
    expect(ok.status).toBe(200);
    expect((await User.findById(newAdmin._id)).mustChangePassword).toBe(false);
  });

  it('an admin password reset sets the flag again', async () => {
    const student = await createUser({ role: 'student', password: 'Original1' });
    const reset = await apiAs(school.admin, app).patch(`/users/${student._id}/password`, {
      newPassword: 'ResetPass1',
    });
    expect(reset.status).toBe(200);
    const { res } = await signIn(student.username, 'ResetPass1');
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it('self-registered and seeded-style accounts are not forced to change', async () => {
    const user = await createUser({ role: 'teacher', password: 'Teacher1234' });
    const { res } = await signIn(user.username, 'Teacher1234');
    expect(res.body.data.mustChangePassword).toBe(false);
  });
});

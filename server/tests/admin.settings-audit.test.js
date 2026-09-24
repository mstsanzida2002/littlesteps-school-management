import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/index.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { apiAs, createSchool } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let school;
let admin;
beforeEach(async () => {
  school = await createSchool();
  admin = apiAs(school.admin);
});

describe('settings', () => {
  it('returns defaults with display ranges', async () => {
    const res = await admin.get('/settings');
    expect(res.body.data).toMatchObject({
      attendanceThreshold: 75,
      lateCountsAsPresent: true,
      weeklyOffDays: ['friday', 'saturday'],
    });
    expect(res.body.data.gradingScale[0]).toEqual({
      grade: 'A+',
      minPercent: 80,
      maxPercent: 100,
      gpa: 5,
    });
    expect(res.body.data.gradingScale.at(-1)).toMatchObject({
      grade: 'F',
      minPercent: 0,
      maxPercent: 33,
    });
  });

  it('updates fields, sorts the scale, and audits before/after values', async () => {
    const res = await admin.patch('/settings', {
      attendanceThreshold: 80,
      lateCountsAsPresent: false,
      gradingScale: [
        { grade: 'C', minPercent: 0 },
        { grade: 'A', minPercent: 70 },
        { grade: 'B', minPercent: 40 },
      ],
    });
    expect(res.status).toBe(200);
    expect(
      res.body.data.gradingScale.map((b) => `${b.grade}:${b.minPercent}-${b.maxPercent}`),
    ).toEqual(['A:70-100', 'B:40-70', 'C:0-40']);

    const log = await AuditLog.findOne({ action: 'settings.update' }).lean();
    expect(log.changes.before).toMatchObject({
      attendanceThreshold: 75,
      lateCountsAsPresent: true,
    });
    expect(log.changes.after).toMatchObject({
      attendanceThreshold: 80,
      lateCountsAsPresent: false,
    });
    expect(log.changes.after.weeklyOffDays).toBeUndefined(); // unchanged fields are not logged
  });

  it.each([
    [
      'no band starting at 0 (gap)',
      [
        { grade: 'A', minPercent: 50 },
        { grade: 'B', minPercent: 10 },
      ],
      /start at 0%/,
    ],
    [
      'two bands at the same threshold (overlap)',
      [
        { grade: 'A', minPercent: 50 },
        { grade: 'B', minPercent: 50 },
        { grade: 'F', minPercent: 0 },
      ],
      /overlap/,
    ],
    [
      'duplicate grade names',
      [
        { grade: 'A', minPercent: 50 },
        { grade: 'a', minPercent: 0 },
      ],
      /more than once/,
    ],
    [
      'a threshold above 100',
      [
        { grade: 'A', minPercent: 120 },
        { grade: 'F', minPercent: 0 },
      ],
      /100/,
    ],
    [
      'GPA rising as grades fall',
      [
        { grade: 'A', minPercent: 50, gpa: 3 },
        { grade: 'F', minPercent: 0, gpa: 4 },
      ],
      /GPA/,
    ],
    ['a single band', [{ grade: 'P', minPercent: 0 }], /at least two/],
  ])('rejects a grading scale with %s', async (_label, gradingScale, message) => {
    const res = await admin.patch('/settings', { gradingScale });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body.errors)).toMatch(message);
  });

  it('validates weekly off days', async () => {
    const dup = await admin.patch('/settings', { weeklyOffDays: ['friday', 'friday'] });
    expect(dup.status).toBe(422);
    const all = await admin.patch('/settings', {
      weeklyOffDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    });
    expect(all.status).toBe(422);
  });
});

describe('audit log endpoint', () => {
  beforeEach(async () => {
    const other = await createUser({ role: 'admin' });
    await AuditLog.create([
      {
        actorId: school.admin._id,
        action: 'class.create',
        entityType: 'Class',
        createdAt: new Date('2026-09-20T05:00:00Z'),
      },
      {
        actorId: school.admin._id,
        action: 'user.suspend',
        entityType: 'User',
        createdAt: new Date('2026-09-21T05:00:00Z'),
      },
      // 23:30 in Dhaka on the 22nd, but 17:30 UTC on the 22nd — must count as the 22nd.
      {
        actorId: other._id,
        action: 'user.create',
        entityType: 'User',
        createdAt: new Date('2026-09-22T17:30:00Z'),
      },
      // 00:30 in Dhaka on the 23rd (still the 22nd in UTC) — must count as the 23rd.
      {
        actorId: other._id,
        action: 'user.create',
        entityType: 'User',
        createdAt: new Date('2026-09-22T18:30:00Z'),
      },
    ]);
  });

  it('paginates newest first with actor details', async () => {
    const res = await admin.get('/audit-logs?limit=2');
    expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 });
    expect(res.body.data[0].actorId).toHaveProperty('username');
  });

  it('filters by action, actor, entity type and Dhaka date range', async () => {
    expect((await admin.get('/audit-logs?action=user.create')).body.meta.total).toBe(2);
    expect((await admin.get(`/audit-logs?actorId=${school.admin._id}`)).body.meta.total).toBe(2);
    expect((await admin.get('/audit-logs?entityType=Class')).body.meta.total).toBe(1);

    const day22 = await admin.get('/audit-logs?from=2026-09-22&to=2026-09-22');
    expect(day22.body.meta.total).toBe(1);
    expect(day22.body.data[0].createdAt).toBe('2026-09-22T17:30:00.000Z');

    expect((await admin.get('/audit-logs?from=2026-09-23&to=2026-09-21')).status).toBe(422);
  });
});

describe('admin-only access', () => {
  const endpoints = [
    ['get', '/users'],
    ['post', '/users'],
    ['get', '/users/next-roll'],
    ['patch', '/users/64b000000000000000000000'],
    ['patch', '/users/64b000000000000000000000/suspend'],
    ['patch', '/users/64b000000000000000000000/approve'],
    ['delete', '/users/64b000000000000000000000'],
    ['get', '/classes'],
    ['post', '/sections'],
    ['delete', '/subjects/64b000000000000000000000'],
    ['post', '/sessions/64b000000000000000000000/activate'],
    ['get', '/teacher-assignments'],
    ['post', '/teacher-assignments'],
    ['get', '/settings'],
    ['patch', '/settings'],
    ['get', '/audit-logs'],
  ];

  it.each(endpoints)(
    '%s %s is 403 for teachers/students and 401 when signed out',
    async (method, path) => {
      const student = await createUser({ role: 'student' });
      expect((await apiAs(school.teacher)[method](path)).status).toBe(403);
      expect((await apiAs(student)[method](path)).status).toBe(403);
      expect((await request(createApp())[method](`/api${path}`)).status).toBe(401);
    },
  );
});

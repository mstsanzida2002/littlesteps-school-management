import { Router } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { authenticate, authorize } from '../src/middleware/auth.js';
import { studentOwnsRecord, teacherOwnsAssignment } from '../src/middleware/ownership.js';
import {
  AcademicSession,
  Class,
  Section,
  StudentProfile,
  Subject,
  TeacherAssignment,
} from '../src/models/index.js';
import { startTestDB, stopTestDB } from './helpers/db.js';
import { createUser, tokenFor } from './helpers/factories.js';

// Test-only routes exercising the reusable guards, mounted at /api/test.
const ok = (req, res) => res.json({ success: true });
const testRouter = Router();
testRouter.get('/admin-only', authenticate, authorize('admin'), ok);
testRouter.get('/sections/:classId/:sectionId', authenticate, teacherOwnsAssignment(), ok);
testRouter.get(
  '/sections/:classId/:sectionId/subjects/:subjectId',
  authenticate,
  teacherOwnsAssignment(),
  ok,
);
testRouter.get('/students/:studentId/records', authenticate, studentOwnsRecord(), ok);

const app = createApp({ testRouter });
const get = (path, user) =>
  tokenFor(user).then((token) =>
    request(app).get(`/api/test${path}`).set('Authorization', `Bearer ${token}`),
  );

let admin, teacher, otherTeacher, student, otherStudent;
let nurseryA, kg1B, english, math;

beforeAll(async () => {
  await startTestDB();

  const session = await AcademicSession.create({
    name: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  });
  const oldSession = await AcademicSession.create({
    name: '2025',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  });
  const [nursery, kg1] = await Class.create([
    { name: 'Nursery', order: 2 },
    { name: 'KG-1', order: 3 },
  ]);
  const [secA, secB] = await Section.create([
    { classId: nursery._id, name: 'A' },
    { classId: kg1._id, name: 'B' },
  ]);
  [english, math] = await Subject.create([
    { name: 'English', code: 'ENG' },
    { name: 'Math', code: 'MATH' },
  ]);
  nurseryA = { classId: nursery._id, sectionId: secA._id };
  kg1B = { classId: kg1._id, sectionId: secB._id };

  [admin, teacher, otherTeacher, student, otherStudent] = await Promise.all([
    createUser({ role: 'admin' }),
    createUser({ role: 'teacher' }),
    createUser({ role: 'teacher' }),
    createUser({ role: 'student' }),
    createUser({ role: 'student' }),
  ]);

  await TeacherAssignment.create([
    // teacher: Nursery-A English, active session
    { teacherId: teacher._id, ...nurseryA, subjectId: english._id, sessionId: session._id },
    // otherTeacher: KG-1 B in the active session, and Nursery-A only in an old session
    { teacherId: otherTeacher._id, ...kg1B, subjectId: math._id, sessionId: session._id },
    { teacherId: otherTeacher._id, ...nurseryA, subjectId: math._id, sessionId: oldSession._id },
  ]);

  const guardian = { name: 'Guardian', relation: 'mother', phone: '01712345678' };
  await StudentProfile.create([
    {
      userId: student._id,
      rollNo: 1,
      ...nurseryA,
      sessionId: session._id,
      dateOfBirth: '2022-01-01',
      admissionDate: '2026-01-05',
      guardian,
    },
    {
      userId: otherStudent._id,
      rollNo: 1,
      ...kg1B,
      sessionId: session._id,
      dateOfBirth: '2021-01-01',
      admissionDate: '2025-01-05',
      guardian,
    },
  ]);
});

afterAll(stopTestDB);

const sectionPath = ({ classId, sectionId }) => `/sections/${classId}/${sectionId}`;

describe('authorize()', () => {
  it('allows listed roles only', async () => {
    expect((await get('/admin-only', admin)).status).toBe(200);
    expect((await get('/admin-only', teacher)).status).toBe(403);
    expect((await get('/admin-only', student)).status).toBe(403);
    expect((await request(app).get('/api/test/admin-only')).status).toBe(401);
  });
});

describe('teacherOwnsAssignment()', () => {
  it('allows a teacher their assigned class-section', async () => {
    expect((await get(sectionPath(nurseryA), teacher)).status).toBe(200);
    expect((await get(`${sectionPath(nurseryA)}/subjects/${english._id}`, teacher)).status).toBe(
      200,
    );
  });

  it('denies a teacher a class-section they are not assigned to', async () => {
    const res = await get(sectionPath(kg1B), teacher);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not assigned/);
  });

  it('denies an unassigned subject within an assigned class-section', async () => {
    expect((await get(`${sectionPath(nurseryA)}/subjects/${math._id}`, teacher)).status).toBe(403);
  });

  it('ignores assignments from inactive sessions', async () => {
    expect((await get(sectionPath(nurseryA), otherTeacher)).status).toBe(403);
    expect((await get(sectionPath(kg1B), otherTeacher)).status).toBe(200);
  });

  it('always allows admins and never students', async () => {
    expect((await get(sectionPath(kg1B), admin)).status).toBe(200);
    expect((await get(sectionPath(nurseryA), student)).status).toBe(403);
  });

  it('rejects malformed ids with 400', async () => {
    expect((await get('/sections/nope/nope', teacher)).status).toBe(400);
  });
});

describe('studentOwnsRecord()', () => {
  it("allows a student their own record and denies another student's", async () => {
    expect((await get(`/students/${student._id}/records`, student)).status).toBe(200);
    const res = await get(`/students/${otherStudent._id}/records`, student);
    expect(res.status).toBe(403);
  });

  it('allows teachers only for students in their assigned class-sections', async () => {
    expect((await get(`/students/${student._id}/records`, teacher)).status).toBe(200);
    expect((await get(`/students/${otherStudent._id}/records`, teacher)).status).toBe(403);
  });

  it('always allows admins', async () => {
    expect((await get(`/students/${otherStudent._id}/records`, admin)).status).toBe(200);
  });
});

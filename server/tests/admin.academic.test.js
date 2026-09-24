import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AcademicSession, Attendance, AuditLog, StudentProfile } from '../src/models/index.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
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

async function enrol(sectionKey = 'pgB', classKey = 'playgroup', rollNo = 1) {
  const student = await createUser({ role: 'student' });
  await StudentProfile.create({
    userId: student._id,
    rollNo,
    classId: school.classes[classKey]._id,
    sectionId: school.sections[sectionKey]._id,
    sessionId: school.session._id,
    dateOfBirth: '2022-01-01',
    admissionDate: '2026-01-05',
    guardian,
  });
  return student;
}

describe('classes, sections, subjects CRUD', () => {
  it('creates, lists (with counts), updates and deletes a class', async () => {
    const created = await admin.post('/classes', { name: 'KG-1', order: 3 });
    expect(created.status).toBe(201);
    const id = created.body.data._id;

    await enrol();
    const list = await admin.get('/classes?sort=order');
    expect(list.body.data.map((c) => c.name)).toEqual(['Playgroup', 'Nursery', 'KG-1']);
    expect(list.body.data[0]).toMatchObject({ sectionCount: 2, studentCount: 1 });

    const updated = await admin.patch(`/classes/${id}`, { description: 'Five-year-olds' });
    expect(updated.body.data.description).toBe('Five-year-olds');

    expect((await admin.delete(`/classes/${id}`)).status).toBe(200);
    expect(await AuditLog.countDocuments({ entityType: 'Class' })).toBe(3);
  });

  it('rejects duplicate names and a section moving class', async () => {
    expect((await admin.post('/classes', { name: 'Playgroup', order: 9 })).status).toBe(409);
    const move = await admin.patch(`/sections/${school.sections.pgA._id}`, {
      classId: String(school.classes.nursery._id),
    });
    expect(move.status).toBe(400);
  });

  it('refuses capacity below current enrolment', async () => {
    await enrol('pgB', 'playgroup', 1);
    await enrol('pgB', 'playgroup', 2);
    const res = await admin.patch(`/sections/${school.sections.pgB._id}`, { capacity: 1 });
    expect(res.status).toBe(409);
  });

  it('creates subjects with normalized codes and lists by search', async () => {
    const res = await admin.post('/subjects', { name: 'Rhymes', code: 'rhy' });
    expect(res.body.data.code).toBe('RHY');
    const search = await admin.get('/subjects?search=rhy');
    expect(search.body.data).toHaveLength(1);
  });
});

describe('delete blocking', () => {
  it('a section with students or attendance cannot be deleted', async () => {
    const student = await enrol();
    await Attendance.create({
      studentId: student._id,
      classId: school.classes.playgroup._id,
      sectionId: school.sections.pgB._id,
      subjectId: school.subjects.english._id,
      sessionId: school.session._id,
      teacherId: school.teacher._id,
      date: '2026-09-20',
      status: 'absent',
    });

    const res = await admin.delete(`/sections/${school.sections.pgB._id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IN_USE');
    expect(res.body.message).toBe(
      'Cannot delete section Playgroup-B: 1 student and 1 attendance record use it.',
    );
    expect(res.body.details.references).toEqual({ students: 1, attendance: 1 });
  });

  it('a class with sections, and a subject with attendance, cannot be deleted', async () => {
    const cls = await admin.delete(`/classes/${school.classes.nursery._id}`);
    expect(cls.status).toBe(409);
    expect(cls.body.message).toMatch(/1 section use it/);

    await Attendance.create({
      studentId: school.teacher._id,
      classId: school.classes.playgroup._id,
      sectionId: school.sections.pgA._id,
      subjectId: school.subjects.math._id,
      sessionId: school.session._id,
      teacherId: school.teacher._id,
      date: '2026-09-20',
      status: 'present',
    });
    expect((await admin.delete(`/subjects/${school.subjects.math._id}`)).status).toBe(409);
    expect((await admin.delete(`/subjects/${school.subjects.drawing._id}`)).status).toBe(200);
  });

  it('an unreferenced section can be deleted', async () => {
    expect((await admin.delete(`/sections/${school.sections.nurA._id}`)).status).toBe(200);
  });
});

describe('academic sessions', () => {
  let next;
  beforeEach(async () => {
    const res = await admin.post('/sessions', {
      name: '2027',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    });
    next = res.body.data;
  });

  it('new sessions start inactive; dates are validated', async () => {
    expect(next.isActive).toBe(false);
    const bad = await admin.post('/sessions', {
      name: 'bad',
      startDate: '2028-12-31',
      endDate: '2028-01-01',
    });
    expect(bad.status).toBe(422);
    const badUpdate = await admin.patch(`/sessions/${next._id}`, { startDate: '2028-06-01' });
    expect(badUpdate.status).toBe(422);
  });

  it('switching without confirm returns a summary and changes nothing', async () => {
    await enrol('pgA', 'playgroup', 1);
    await enrol('pgA', 'playgroup', 2);

    const res = await admin.post(`/sessions/${next._id}/activate`, {});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SESSION_SWITCH_CONFIRMATION_REQUIRED');
    expect(res.body.message).toMatch(
      /^2 students are enrolled in 2026 and 0 in 2027\. Teachers will not see unenrolled students after switching\./,
    );
    expect(res.body.details).toMatchObject({
      current: { name: '2026', students: 2 },
      target: { name: '2027', students: 0 },
    });
    expect((await AcademicSession.findOne({ isActive: true })).name).toBe('2026');
  });

  it('switching with confirm deactivates the old session and activates the new one', async () => {
    const res = await admin.post(`/sessions/${next._id}/activate`, { confirm: true });
    expect(res.status).toBe(200);
    const active = await AcademicSession.find({ isActive: true }).lean();
    expect(active.map((s) => s.name)).toEqual(['2027']);
    expect(await AuditLog.exists({ action: 'session.activate' })).toBeTruthy();

    expect((await admin.post(`/sessions/${next._id}/activate`, { confirm: true })).status).toBe(
      409,
    );
  });

  it('the active session cannot be deleted; an unused inactive one can', async () => {
    expect((await admin.delete(`/sessions/${school.session._id}`)).status).toBe(409);
    expect((await admin.delete(`/sessions/${next._id}`)).status).toBe(200);
  });
});

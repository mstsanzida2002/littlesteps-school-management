import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Attendance, AuditLog, TeacherAssignment } from '../src/models/index.js';
import { teacherHasAssignment } from '../src/services/access.service.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { apiAs, createSchool } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let school;
let admin;
let secondTeacher;
beforeEach(async () => {
  school = await createSchool();
  admin = apiAs(school.admin);
  secondTeacher = await createUser({ role: 'teacher', name: 'Nasrin Sultana' });
});

const slot = (day, startTime, endTime) => ({ day, startTime, endTime });
const assignBody = ({
  teacher = school.teacher,
  section = 'pgA',
  subject = 'english',
  schedule = [],
} = {}) => ({
  teacherId: String(teacher._id),
  classId: String(section === 'nurA' ? school.classes.nursery._id : school.classes.playgroup._id),
  sectionId: String(school.sections[section]._id),
  subjectId: String(school.subjects[subject]._id),
  schedule,
});

describe('creating assignments', () => {
  it('assigns a teacher in the active session with a schedule and audits it', async () => {
    const res = await admin.post(
      '/teacher-assignments',
      assignBody({ schedule: [slot('sunday', '08:00', '08:30')] }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'active',
      teacherId: { name: 'Farhana Akter' },
      classId: { name: 'Playgroup' },
      sessionId: { name: '2026' },
    });
    expect(await AuditLog.exists({ action: 'assignment.create' })).toBeTruthy();

    const list = await admin.get(`/teacher-assignments?teacherId=${school.teacher._id}`);
    expect(list.body.meta.total).toBe(1);
  });

  it('validates teacher, section-in-class and duplicates', async () => {
    const student = await createUser({ role: 'student' });
    expect(
      (await admin.post('/teacher-assignments', assignBody({ teacher: student }))).status,
    ).toBe(422);

    const suspended = await createUser({ role: 'teacher', status: 'suspended' });
    const inactive = await admin.post('/teacher-assignments', assignBody({ teacher: suspended }));
    expect(inactive.status).toBe(422);
    expect(inactive.body.errors[0].message).toMatch(/suspended/);

    const wrongSection = await admin.post('/teacher-assignments', {
      ...assignBody(),
      sectionId: String(school.sections.nurA._id),
    });
    expect(wrongSection.status).toBe(422);

    await admin.post('/teacher-assignments', assignBody());
    expect((await admin.post('/teacher-assignments', assignBody())).status).toBe(409);
  });

  it('rejects overlapping slots within one schedule and end-before-start', async () => {
    const overlap = await admin.post(
      '/teacher-assignments',
      assignBody({
        schedule: [slot('monday', '08:00', '09:00'), slot('monday', '08:30', '09:30')],
      }),
    );
    expect(overlap.status).toBe(422);
    const backwards = await admin.post(
      '/teacher-assignments',
      assignBody({ schedule: [slot('monday', '09:00', '08:00')] }),
    );
    expect(backwards.status).toBe(422);
  });
});

describe('time-clash detection', () => {
  beforeEach(async () => {
    await admin.post(
      '/teacher-assignments',
      assignBody({ schedule: [slot('sunday', '09:00', '09:30')] }),
    );
  });

  it('a teacher cannot teach two classes at overlapping times', async () => {
    const res = await admin.post(
      '/teacher-assignments',
      assignBody({ section: 'pgB', schedule: [slot('sunday', '09:15', '09:45')] }),
    );
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SCHEDULE_CLASH');
    expect(res.body.message).toBe(
      'Farhana Akter already teaches English to Playgroup-A on Sunday 09:00–09:30.',
    );
    expect(res.body.details.clashes[0]).toMatchObject({ type: 'teacher' });
  });

  it('a class-section cannot have two subjects at overlapping times, even with different teachers', async () => {
    const res = await admin.post(
      '/teacher-assignments',
      assignBody({
        teacher: secondTeacher,
        subject: 'math',
        schedule: [slot('sunday', '08:45', '09:05')],
      }),
    );
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'Playgroup-A already has English (Farhana Akter) on Sunday 09:00–09:30.',
    );
    expect(res.body.details.clashes.map((c) => c.type)).toEqual(['classSection']);
  });

  it('back-to-back slots and other days do not clash', async () => {
    const adjacent = await admin.post(
      '/teacher-assignments',
      assignBody({
        teacher: secondTeacher,
        subject: 'math',
        schedule: [slot('sunday', '09:30', '10:00'), slot('monday', '09:00', '09:30')],
      }),
    );
    expect(adjacent.status).toBe(201);
    const otherSection = await admin.post(
      '/teacher-assignments',
      assignBody({
        teacher: secondTeacher,
        section: 'pgB',
        schedule: [slot('sunday', '09:00', '09:30')],
      }),
    );
    expect(otherSection.status).toBe(201);
  });

  it('updating a schedule does not clash with its own slots but does with others', async () => {
    const own = await TeacherAssignment.findOne({ teacherId: school.teacher._id });
    const shift = await admin.patch(`/teacher-assignments/${own._id}`, {
      schedule: [slot('sunday', '09:10', '09:40')],
    });
    expect(shift.status).toBe(200);

    const math = await admin.post(
      '/teacher-assignments',
      assignBody({
        teacher: secondTeacher,
        subject: 'math',
        schedule: [slot('tuesday', '10:00', '10:30')],
      }),
    );
    const clash = await admin.patch(`/teacher-assignments/${math.body.data._id}`, {
      schedule: [slot('sunday', '09:30', '10:00')],
    });
    expect(clash.status).toBe(409);
  });
});

describe('removing assignments', () => {
  it('deletes an assignment with no recorded history', async () => {
    const created = await admin.post('/teacher-assignments', assignBody());
    const res = await admin.delete(`/teacher-assignments/${created.body.data._id}`);
    expect(res.body.data.outcome).toBe('deleted');
    expect(await TeacherAssignment.countDocuments()).toBe(0);
  });

  it('ends (not deletes) an assignment with attendance; access stops; re-assigning reactivates it', async () => {
    const created = await admin.post('/teacher-assignments', assignBody());
    await Attendance.create({
      studentId: secondTeacher._id,
      classId: school.classes.playgroup._id,
      sectionId: school.sections.pgA._id,
      subjectId: school.subjects.english._id,
      sessionId: school.session._id,
      teacherId: school.teacher._id,
      date: '2026-09-20',
      status: 'present',
    });
    const scope = { classId: school.classes.playgroup._id, sectionId: school.sections.pgA._id };
    expect(await teacherHasAssignment(school.teacher._id, scope)).toBe(true);

    const res = await admin.delete(`/teacher-assignments/${created.body.data._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('ended');
    expect(res.body.message).toBe(
      'Assignment ended instead of deleted because it has history (1 attendance record).',
    );
    expect(await teacherHasAssignment(school.teacher._id, scope)).toBe(false);

    const again = await admin.post(
      '/teacher-assignments',
      assignBody({ schedule: [slot('monday', '08:00', '08:30')] }),
    );
    expect(again.status).toBe(201);
    expect(again.body.data._id).toBe(created.body.data._id);
    expect(again.body.data.status).toBe('active');
    expect(await AuditLog.exists({ action: 'assignment.reactivate' })).toBeTruthy();
  });
});

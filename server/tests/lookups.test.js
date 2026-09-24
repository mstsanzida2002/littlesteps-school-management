import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { Settings, TeacherAssignment } from '../src/models/index.js';
import { toDateKey, todaySchoolDate } from '../src/utils/date.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { apiAs, createSchool } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

const assignment = (school, { section, subject, teacher = school.teacher, days = ['sunday'] }) => ({
  teacherId: teacher._id,
  classId: section.classId,
  sectionId: section._id,
  subjectId: school.subjects[subject]._id,
  sessionId: school.session._id,
  schedule: days.map((day) => ({ day, startTime: '08:00', endTime: '08:30' })),
});

describe('GET /api/settings/school', () => {
  it('gives every signed-in role the school rules, today and the active session', async () => {
    const school = await createSchool();
    await Settings.get();
    const student = await createUser({ role: 'student' });

    for (const user of [school.teacher, student, school.admin]) {
      const res = await apiAs(user).get('/settings/school');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        weeklyOffDays: ['friday', 'saturday'],
        attendanceBackdateDays: 7,
        attendanceThreshold: 75,
        lateCountsAsPresent: true,
        today: toDateKey(todaySchoolDate()),
        session: { name: '2026', startDate: '2026-01-01', endDate: '2026-12-31' },
      });
      expect(res.body.data.gradingScale[0]).toHaveProperty('grade');
      expect(res.body.data).not.toHaveProperty('updatedAt');
    }
  });

  it('requires sign-in', async () => {
    expect((await request(createApp()).get('/api/settings/school')).status).toBe(401);
  });

  it('does not open the admin settings to teachers', async () => {
    const school = await createSchool();
    expect((await apiAs(school.teacher).get('/settings')).status).toBe(403);
    expect(
      (await apiAs(school.teacher).patch('/settings', { attendanceThreshold: 50 })).status,
    ).toBe(403);
  });
});

describe('GET /api/teacher-assignments/mine', () => {
  it("groups the teacher's active assignments by class-section with the timetable", async () => {
    const school = await createSchool();
    const { pgA, pgB, nurA } = school.sections;
    const other = await createUser({ role: 'teacher' });
    await TeacherAssignment.create([
      assignment(school, { section: pgA, subject: 'math', days: ['sunday', 'monday'] }),
      assignment(school, { section: pgA, subject: 'english' }),
      assignment(school, { section: pgB, subject: 'english' }),
      assignment(school, { section: nurA, subject: 'drawing', teacher: other }),
      { ...assignment(school, { section: nurA, subject: 'math' }), status: 'ended' },
    ]);

    const res = await apiAs(school.teacher).get('/teacher-assignments/mine');
    expect(res.status).toBe(200);
    const { classSections, wholeClasses, session } = res.body.data;
    expect(session.name).toBe('2026');
    expect(classSections.map((cs) => cs.label)).toEqual(['Playgroup-A', 'Playgroup-B']);
    expect(classSections[0].subjects.map((s) => s.name)).toEqual(['English', 'Math']);
    expect(classSections[0].subjects[1].schedule).toEqual([
      { day: 'sunday', startTime: '08:00', endTime: '08:30' },
      { day: 'monday', startTime: '08:00', endTime: '08:30' },
    ]);
    // Teaches both Playgroup sections → may invite the whole class. Ended Nursery → nothing.
    expect(wholeClasses).toEqual([
      { classId: String(school.classes.playgroup._id), name: 'Playgroup' },
    ]);
  });

  it('does not count a class as whole when one of its sections is missing', async () => {
    const school = await createSchool();
    await TeacherAssignment.create(
      assignment(school, { section: school.sections.pgA, subject: 'math' }),
    );
    const res = await apiAs(school.teacher).get('/teacher-assignments/mine');
    expect(res.body.data.wholeClasses).toEqual([]);
  });

  it('is for teachers only', async () => {
    const school = await createSchool();
    const student = await createUser({ role: 'student' });
    expect((await apiAs(student).get('/teacher-assignments/mine')).status).toBe(403);
    expect((await apiAs(school.admin).get('/teacher-assignments/mine')).status).toBe(403);
    expect((await request(createApp()).get('/api/teacher-assignments/mine')).status).toBe(401);
    // The admin list is still admin-only.
    expect((await apiAs(school.teacher).get('/teacher-assignments')).status).toBe(403);
  });
});

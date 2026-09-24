import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { Notice, Notification, TeacherAssignment, User } from '../src/models/index.js';
import { addDays, toDateKey, todaySchoolDate } from '../src/utils/date.js';
import {
  assign,
  createAttendanceSchool,
  insertAttendance,
  isSchoolDay,
  recentSchoolDays,
} from './helpers/attendance.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { apiAs } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let school;
let admin;
let ayaan;
beforeEach(async () => {
  school = await createAttendanceSchool();
  admin = apiAs(school.admin);
  [ayaan] = school.students;
});

const notice = (overrides = {}) => ({
  title: 'Sports day on Thursday',
  body: 'Please send children in white uniforms.',
  audience: 'all',
  ...overrides,
});

describe('notices', () => {
  it('drafts notify nobody; publishing notifies every active user in the audience once', async () => {
    const suspended = await createUser({ role: 'student', status: 'suspended' });
    const draft = await admin.post('/notices', notice());
    expect(draft.status).toBe(201);
    expect(draft.body.data.recipients).toBe(0);
    expect(await Notification.countDocuments({ type: 'notice' })).toBe(0);

    const published = await admin.post(`/notices/${draft.body.data.notice._id}/publish`);
    expect(published.status).toBe(200);
    // admin + 2 teachers + 3 students = 6 active users; the suspended student is skipped.
    expect(published.body.data.recipients).toBe(6);
    expect(await Notification.countDocuments({ recipientId: suspended._id })).toBe(0);
    expect(await Notification.countDocuments({ recipientId: ayaan._id, type: 'notice' })).toBe(1);
    expect((await admin.post(`/notices/${draft.body.data.notice._id}/publish`)).status).toBe(409);

    // Editing a published notice does not notify again.
    await admin.patch(`/notices/${draft.body.data.notice._id}`, { title: 'Sports day moved' });
    expect(await Notification.countDocuments({ type: 'notice' })).toBe(6);
  });

  it('audiences: students and teachers see only what is meant for them; pinned first', async () => {
    await admin.post(
      '/notices',
      notice({ title: 'For teachers', audience: 'teachers', publish: true }),
    );
    await admin.post(
      '/notices',
      notice({ title: 'For students', audience: 'students', publish: true }),
    );
    await admin.post(
      '/notices',
      notice({ title: 'Pinned for all', isPinned: true, publish: true }),
    );
    await admin.post('/notices', notice({ title: 'Still a draft' }));

    const titles = async (user) =>
      (await apiAs(user).get('/notices')).body.data.map((n) => n.title);
    expect(await titles(ayaan)).toEqual(['Pinned for all', 'For students']);
    expect(await titles(school.teacher)).toEqual(['Pinned for all', 'For teachers']);
    expect((await titles(school.admin)).sort()).toEqual(
      ['For students', 'For teachers', 'Pinned for all', 'Still a draft'].sort(),
    );
    expect(
      await Notification.countDocuments({ recipientId: school.teacher._id, type: 'notice' }),
    ).toBe(2);

    const teachersOnly = await Notice.findOne({ title: 'For teachers' });
    expect((await apiAs(ayaan).get(`/notices/${teachersOnly._id}`)).status).toBe(404);
    expect((await apiAs(ayaan).post('/notices', notice())).status).toBe(403);
  });

  it('expired notices disappear for non-admins', async () => {
    const res = await admin.post('/notices', notice({ publish: true }));
    const id = res.body.data.notice._id;
    expect((await apiAs(ayaan).get('/notices')).body.meta.total).toBe(1);
    expect((await admin.patch(`/notices/${id}/expire`)).status).toBe(200);
    expect((await apiAs(ayaan).get('/notices')).body.meta.total).toBe(0);
    expect((await apiAs(ayaan).get(`/notices/${id}`)).status).toBe(404);
    expect((await admin.get('/notices')).body.meta.total).toBe(0);
    expect((await admin.get('/notices?includeExpired=true')).body.data[0].isExpired).toBe(true);
    expect(
      (
        await admin.post(
          '/notices',
          notice({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
        )
      ).status,
    ).toBe(422);
  });
});

describe('dashboards', () => {
  it('each endpoint is only for its role', async () => {
    const cases = [
      ['/dashboard/admin', school.admin],
      ['/dashboard/teacher', school.teacher],
      ['/dashboard/student', ayaan],
    ];
    for (const [path, owner] of cases) {
      expect((await apiAs(owner).get(path)).status).toBe(200);
      for (const other of [school.admin, school.teacher, ayaan].filter((u) => u !== owner)) {
        expect((await apiAs(other).get(path)).status).toBe(403);
      }
      expect((await request(createApp()).get(`/api${path}`)).status).toBe(401);
    }
  });

  it('admin: counts, rates, below-threshold list, unscheduled assignments', async () => {
    await createUser({ role: 'student', status: 'pending', name: 'Waiting Child' });
    await assign(school, { subject: 'english', days: [] }); // no schedule
    const days = recentSchoolDays(6);
    await insertAttendance(school, [
      ...days.map((date) => ({ student: ayaan, date, status: 'absent' })),
      ...days.map((date) => ({ student: school.students[1], date, status: 'present' })),
    ]);

    const { data } = (await admin.get('/dashboard/admin')).body;
    expect(data.counts).toEqual({
      students: 3,
      teachers: 2,
      classes: 2,
      sections: 3,
      pendingApprovals: 1,
    });
    expect(data.pendingApprovals[0].name).toBe('Waiting Child');
    expect(data.attendanceTrend).toHaveLength(6);
    expect(data.attendanceTrend.every((d) => d.percent === 50)).toBe(true);
    expect(data.classComparison).toEqual([
      expect.objectContaining({ class: 'Playgroup', total: 12, attended: 6, percent: 50 }),
    ]);
    expect(data.belowThreshold.total).toBe(1);
    expect(data.belowThreshold.items[0]).toMatchObject({
      name: 'Ayaan Rahman',
      percent: 0,
      classSection: 'Playgroup-A',
    });
    expect(data.assignmentsWithoutSchedule).toEqual([
      expect.objectContaining({
        teacher: 'Farhana Akter',
        subject: 'English',
        classSection: 'Playgroup-A',
      }),
    ]);
    const todayMarked = toDateKey(days[0]) === toDateKey(todaySchoolDate());
    expect(data.todayAttendance.percent).toBe(todayMarked ? 50 : null);
    expect(Array.isArray(data.recentActivity)).toBe(true);
  });

  it('teacher: pending today, per-section rates, frequent absentees, drafts, meetings', async () => {
    await TeacherAssignment.deleteMany({});
    await assign(school, { subject: 'english', days: [school.weekday] });
    // The 4 school days BEFORE the most recent one, so today's marking stays pending.
    const days = recentSchoolDays(5).slice(1);
    await insertAttendance(
      school,
      days.map((date) => ({ student: ayaan, date, status: 'absent' })),
    );
    await apiAs(school.teacher).post('/assessments', {
      name: 'Draft test',
      type: 'class_test',
      mode: 'marks',
      totalMarks: 10,
      classId: String(school.classes.playgroup._id),
      sectionId: String(school.sections.pgA._id),
      subjectId: String(school.subjects.english._id),
      date: school.dayKey,
    });
    await admin.post('/meetings', {
      title: 'Staff meeting',
      type: 'other',
      date: toDateKey(addDays(todaySchoolDate(), 2)),
      time: '15:00',
      venue: 'Office',
      invite: { target: 'none', teacherIds: [String(school.teacher._id)] },
    });

    const { data } = (await apiAs(school.teacher).get('/dashboard/teacher')).body;
    if (isSchoolDay(todaySchoolDate())) {
      expect(data.pendingToday.map((c) => c.label)).toContain('Playgroup-A');
    } else {
      expect(data.today.offDay).toBe(true);
    }
    expect(data.sections).toEqual([expect.objectContaining({ label: 'Playgroup-A' })]);
    expect(data.sections[0].last30Days).toMatchObject({ total: 4, percent: 0 });
    expect(data.frequentAbsentees).toEqual([
      { studentId: String(ayaan._id), name: 'Ayaan Rahman', absentDays: 4 },
    ]);
    expect(data.draftAssessments).toEqual([
      expect.objectContaining({ name: 'Draft test', entries: 0 }),
    ]);
    expect(data.upcomingMeetings.map((m) => m.title)).toEqual(['Staff meeting']);
  });

  it('student: attendance, only published results, meetings with own response, notices', async () => {
    await assign(school, { subject: 'english', days: [school.weekday] });
    await insertAttendance(
      school,
      recentSchoolDays(2).map((date) => ({ student: ayaan, date, status: 'present' })),
    );
    const teacher = apiAs(school.teacher);
    const make = async (name, publish) => {
      const res = await teacher.post('/assessments', {
        name,
        type: 'class_test',
        mode: 'grade',
        classId: String(school.classes.playgroup._id),
        sectionId: String(school.sections.pgA._id),
        subjectId: String(school.subjects.english._id),
        date: school.dayKey,
      });
      const id = res.body.data._id;
      await teacher.put(`/results/${id}`, {
        entries: school.students.map((s) => ({ studentId: String(s._id), grade: 'A' })),
      });
      if (publish) await teacher.patch(`/assessments/${id}/publish`);
    };
    await make('Published test', true);
    await make('Draft test', false);
    const m = await admin.post('/meetings', {
      title: 'Parents meeting',
      type: 'parent_teacher',
      date: toDateKey(addDays(todaySchoolDate(), 2)),
      time: '10:00',
      venue: 'Hall',
      invite: { target: 'all' },
    });
    await apiAs(ayaan).patch(`/meetings/${m.body.data._id}/respond`, { response: 'will_attend' });
    await admin.post('/notices', notice({ publish: true }));

    const { data } = (await apiAs(ayaan).get('/dashboard/student')).body;
    expect(data.attendance).toMatchObject({
      percent: 100,
      counts: { present: 2, absent: 0, late: 0 },
    });
    expect(data.recentResults.map((r) => r.assessment.name)).toEqual(['Published test']);
    expect(data.upcomingMeetings).toEqual([
      expect.objectContaining({
        title: 'Parents meeting',
        myResponse: expect.objectContaining({ response: 'will_attend' }),
      }),
    ]);
    expect(data.notices.map((n) => n.title)).toEqual(['Sports day on Thursday']);
    // result_published + meeting_invite + notice
    expect(data.unreadNotifications).toBe(3);
    expect(await User.countDocuments()).toBeGreaterThan(0);
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Meeting, Notification, StudentProfile, TeacherAssignment } from '../src/models/index.js';
import { addDays, toDateKey, todaySchoolDate } from '../src/utils/date.js';
import { assign, createAttendanceSchool } from './helpers/attendance.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { apiAs, guardian } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let school;
let admin;
let farhana;
let ayaan;
let nusrat;
let arham;
let pgBStudent;
let nurStudent;
beforeEach(async () => {
  school = await createAttendanceSchool();
  admin = apiAs(school.admin);
  farhana = apiAs(school.teacher);
  [ayaan, nusrat, arham] = school.students;
  await assign(school, { subject: 'english', days: [school.weekday] }); // Farhana: Playgroup-A only
  const enrol = async (name, classKey, sectionKey) => {
    const user = await createUser({ role: 'student', name });
    await StudentProfile.create({
      userId: user._id,
      rollNo: 1,
      classId: school.classes[classKey]._id,
      sectionId: school.sections[sectionKey]._id,
      sessionId: school.session._id,
      dateOfBirth: '2021-01-01',
      admissionDate: toDateKey(addDays(todaySchoolDate(), -90)),
      guardian,
    });
    return user;
  };
  pgBStudent = await enrol('Anaya Karim', 'playgroup', 'pgB');
  nurStudent = await enrol('Aariz Mahmud', 'nursery', 'nurA');
});

const future = (days = 3) => toDateKey(addDays(todaySchoolDate(), days));
const meeting = (invite, overrides = {}) => ({
  title: 'Parent-teacher meeting',
  type: 'parent_teacher',
  date: future(),
  time: '10:00',
  durationMinutes: 45,
  venue: 'Playgroup classroom',
  invite,
  ...overrides,
});
const sid = (x) => String(x._id);
const invitees = async (id) =>
  (await Meeting.findById(id).lean()).inviteeStudentIds.map(String).sort();
const notes = (user, type) =>
  Notification.find({ recipientId: user._id, ...(type && { type }) }).lean();

describe('invite resolution', () => {
  it('admin: all / classes / sections / students / teachers resolve to stored ids', async () => {
    const all = await admin.post('/meetings', meeting({ target: 'all' }));
    expect(all.status).toBe(201);
    expect(await invitees(all.body.data._id)).toEqual(
      [ayaan, nusrat, arham, pgBStudent, nurStudent].map(sid).sort(),
    );
    expect(all.body.data.dateTime).toBe(new Date(`${future()}T04:00:00.000Z`).toISOString()); // 10:00 Dhaka

    const cls = await admin.post(
      '/meetings',
      meeting({ target: 'classes', classIds: [sid(school.classes.playgroup)] }),
    );
    expect(await invitees(cls.body.data._id)).toEqual(
      [ayaan, nusrat, arham, pgBStudent].map(sid).sort(),
    );

    const staff = await admin.post(
      '/meetings',
      meeting({ target: 'none', teacherIds: [sid(school.teacher)] }, { title: 'Staff meeting' }),
    );
    expect(staff.status).toBe(201);
    expect((await Meeting.findById(staff.body.data._id)).inviteeTeacherIds.map(String)).toEqual([
      sid(school.teacher),
    ]);
    expect(await notes(school.teacher, 'meeting_invite')).toHaveLength(1);
  });

  it('teachers invite only within their own class-sections', async () => {
    expect(
      (
        await farhana.post(
          '/meetings',
          meeting({ target: 'sections', sectionIds: [sid(school.sections.pgA)] }),
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await farhana.post(
          '/meetings',
          meeting({ target: 'sections', sectionIds: [sid(school.sections.pgB)] }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await farhana.post(
          '/meetings',
          meeting({ target: 'students', studentIds: [sid(nurStudent)] }),
        )
      ).status,
    ).toBe(403);
    expect((await farhana.post('/meetings', meeting({ target: 'all' }))).status).toBe(403);
    expect(
      (
        await farhana.post(
          '/meetings',
          meeting({
            target: 'sections',
            sectionIds: [sid(school.sections.pgA)],
            teacherIds: [sid(school.secondTeacher)],
          }),
        )
      ).status,
    ).toBe(403);

    // A whole class only when the teacher teaches every section of it.
    const wholeClass = meeting({ target: 'classes', classIds: [sid(school.classes.playgroup)] });
    expect((await farhana.post('/meetings', wholeClass)).status).toBe(403);
    await TeacherAssignment.create({
      teacherId: school.teacher._id,
      classId: school.classes.playgroup._id,
      sectionId: school.sections.pgB._id,
      subjectId: school.subjects.english._id,
      sessionId: school.session._id,
    });
    expect((await farhana.post('/meetings', wholeClass)).status).toBe(201);
  });

  it('must be in the future, with a venue or an https link', async () => {
    const past = await admin.post(
      '/meetings',
      meeting({ target: 'all' }, { date: toDateKey(addDays(todaySchoolDate(), -1)) }),
    );
    expect(past.status).toBe(422);
    const http = await admin.post(
      '/meetings',
      meeting({ target: 'all' }, { venue: undefined, onlineLink: 'http://meet.example.com/x' }),
    );
    expect(http.status).toBe(422);
    const online = await admin.post(
      '/meetings',
      meeting({ target: 'all' }, { venue: undefined, onlineLink: 'https://meet.example.com/x' }),
    );
    expect(online.status).toBe(201);
  });
});

describe('visibility', () => {
  it('invitees see only their meetings; teachers see organized or invited', async () => {
    const created = await farhana.post(
      '/meetings',
      meeting({ target: 'students', studentIds: [sid(ayaan)] }),
    );
    const id = created.body.data._id;
    const asAyaan = await apiAs(ayaan).get(`/meetings/${id}`);
    expect(asAyaan.status).toBe(200);
    expect(asAyaan.body.data.inviteeStudentIds).toBeUndefined(); // students don't see the list
    expect(asAyaan.body.data.canRespond).toBe(true);
    expect((await apiAs(nusrat).get(`/meetings/${id}`)).status).toBe(404);
    expect((await apiAs(school.secondTeacher).get(`/meetings/${id}`)).status).toBe(404);
    expect((await apiAs(nusrat).get('/meetings')).body.meta.total).toBe(0);
    expect((await farhana.get('/meetings?when=upcoming')).body.meta.total).toBe(1);
    expect((await admin.get('/meetings')).body.meta.total).toBe(1);
  });
});

describe('RSVP', () => {
  let id;
  beforeEach(async () => {
    const res = await farhana.post(
      '/meetings',
      meeting({ target: 'sections', sectionIds: [sid(school.sections.pgA)] }),
    );
    id = res.body.data._id;
  });

  it('students respond and can change their answer; organizer sees the summary', async () => {
    const r1 = await apiAs(ayaan).patch(`/meetings/${id}/respond`, { response: 'will_attend' });
    expect(r1.body.data.myResponse.response).toBe('will_attend');
    await apiAs(ayaan).patch(`/meetings/${id}/respond`, {
      response: 'cannot_attend',
      note: 'Fever',
    });
    await apiAs(nusrat).patch(`/meetings/${id}/respond`, { response: 'will_attend' });

    const summary = await farhana.get(`/meetings/${id}/responses`);
    expect(summary.body.data.counts).toEqual({ will_attend: 1, cannot_attend: 1, no_response: 1 });
    expect(summary.body.data.students.map((s) => [s.name, s.response, s.note])).toEqual([
      ['Ayaan Rahman', 'cannot_attend', 'Fever'],
      ['Nusrat Jahan', 'will_attend', null],
      ['Arham Hossain', 'no_response', null],
    ]);
    expect((await apiAs(ayaan).get(`/meetings/${id}/responses`)).status).toBe(403);
    expect((await apiAs(school.secondTeacher).get(`/meetings/${id}/responses`)).status).toBe(404);
  });

  it('is rejected after the meeting starts and after cancellation', async () => {
    await Meeting.updateOne({ _id: id }, { dateTime: new Date(Date.now() - 60_000) });
    const late = await apiAs(ayaan).patch(`/meetings/${id}/respond`, { response: 'will_attend' });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('MEETING_STARTED');

    const other = await farhana.post(
      '/meetings',
      meeting({ target: 'sections', sectionIds: [sid(school.sections.pgA)] }),
    );
    await farhana.post(`/meetings/${other.body.data._id}/cancel`, { reason: 'Heavy rain' });
    const cancelled = await apiAs(ayaan).patch(`/meetings/${other.body.data._id}/respond`, {
      response: 'will_attend',
    });
    expect(cancelled.status).toBe(409);
    expect(cancelled.body.code).toBe('MEETING_CANCELLED');
    expect(
      (await apiAs(pgBStudent).patch(`/meetings/${id}/respond`, { response: 'will_attend' }))
        .status,
    ).toBe(404);
  });
});

describe('update and cancel notifications', () => {
  it('detail changes notify everyone; invite changes notify only added and removed', async () => {
    const res = await farhana.post(
      '/meetings',
      meeting({ target: 'sections', sectionIds: [sid(school.sections.pgA)] }),
    );
    const id = res.body.data._id;
    await apiAs(nusrat).patch(`/meetings/${id}/respond`, { response: 'will_attend' });

    await farhana.patch(`/meetings/${id}`, { time: '11:30' });
    for (const s of [ayaan, nusrat, arham])
      expect(await notes(s, 'meeting_updated')).toHaveLength(1);
    const [updated] = await notes(ayaan, 'meeting_updated');
    expect(updated.message).toMatch(/11:30/);

    // Narrow to Ayaan only: Nusrat and Arham removed (and Nusrat's RSVP dropped); nobody added.
    const narrow = await farhana.patch(`/meetings/${id}`, {
      invite: { target: 'students', studentIds: [sid(ayaan)] },
    });
    expect(narrow.body.data).toMatchObject({ added: 0, removed: 2 });
    const removed = (await notes(nusrat, 'meeting_updated')).filter((n) => n.data.removed);
    expect(removed.map((n) => n.title)).toEqual(['No longer invited: Parent-teacher meeting']);
    expect(await notes(ayaan, 'meeting_updated')).toHaveLength(1); // invite-only change: no update for stayers
    expect((await Meeting.findById(id)).responses).toHaveLength(0);
  });

  it('cancelling notifies all invitees and blocks edits', async () => {
    const res = await admin.post(
      '/meetings',
      meeting({ target: 'classes', classIds: [sid(school.classes.playgroup)] }),
    );
    const id = res.body.data._id;
    await admin.post(`/meetings/${id}/cancel`, { reason: 'School closed' });
    for (const s of [ayaan, nusrat, arham, pgBStudent]) {
      const [n] = await notes(s, 'meeting_cancelled');
      expect(n.message).toMatch(/cancelled\. Reason: School closed/);
    }
    expect((await admin.patch(`/meetings/${id}`, { title: 'Changed' })).status).toBe(409);
    expect((await farhana.post(`/meetings/${id}/cancel`, { reason: 'Not needed' })).status).toBe(
      404,
    );
  });
});

describe('enrolment changes keep invitees correct', () => {
  beforeEach(async () => {
    // Upcoming meetings (asserted by title below).
    await admin.post(
      '/meetings',
      meeting({ target: 'sections', sectionIds: [sid(school.sections.pgA)] }),
    );
    await admin.post('/meetings', meeting({ target: 'all' }, { title: 'Annual day' }));
    await admin.post(
      '/meetings',
      meeting({ target: 'students', studentIds: [sid(ayaan)] }, { title: 'Chat about Ayaan' }),
    );
    await admin.post(
      '/meetings',
      meeting(
        { target: 'sections', sectionIds: [sid(school.sections.pgB)] },
        { title: 'PG-B meeting' },
      ),
    );
    // Never touched: a past one and a cancelled one targeting Playgroup-A.
    await Meeting.create({
      title: 'Past',
      type: 'event',
      dateTime: new Date(Date.now() - 86_400_000),
      venue: 'Hall',
      organizerId: school.admin._id,
      sessionId: school.session._id,
      invite: { target: 'sections', sectionIds: [school.sections.pgA._id] },
    });
    const cancelled = (
      await admin.post(
        '/meetings',
        meeting(
          { target: 'sections', sectionIds: [sid(school.sections.pgA)] },
          { title: 'Cancelled' },
        ),
      )
    ).body.data._id;
    await admin.post(`/meetings/${cancelled}/cancel`, { reason: 'Not needed' });
  });

  const invitedTo = async (student) =>
    (await Meeting.find({ inviteeStudentIds: student._id }).select('title').lean())
      .map((m) => m.title)
      .sort();

  it('a newly created student joins upcoming meetings covering them (not past or cancelled)', async () => {
    const res = await admin.post('/users', {
      role: 'student',
      name: 'New Child',
      username: 'new.child',
      password: 'Start2026',
      profile: {
        classId: sid(school.classes.playgroup),
        sectionId: sid(school.sections.pgA),
        dateOfBirth: '2022-02-02',
        guardian,
      },
    });
    expect(res.status).toBe(201);
    const child = { _id: res.body.data._id };
    expect(await invitedTo(child)).toEqual(['Annual day', 'Parent-teacher meeting']);
    expect(await notes(child, 'meeting_invite')).toHaveLength(2);
  });

  it('an approved registration joins the same way', async () => {
    const pending = await createUser({
      role: 'student',
      status: 'pending',
      registration: { guardian, dateOfBirth: '2022-03-10', gender: 'male' },
    });
    const res = await admin.patch(`/users/${pending._id}/approve`, {
      classId: sid(school.classes.playgroup),
      sectionId: sid(school.sections.pgB),
    });
    expect(res.status).toBe(200);
    expect(await invitedTo(pending)).toEqual(['Annual day', 'PG-B meeting']);
    expect(await notes(pending, 'meeting_invite')).toHaveLength(2);
  });

  it('a transfer leaves section/class-invited meetings, keeps individual and "all" invites, joins the new section', async () => {
    // 'Cancelled' was cancelled after Ayaan was invited; cancelled meetings never change.
    expect(await invitedTo(ayaan)).toEqual([
      'Annual day',
      'Cancelled',
      'Chat about Ayaan',
      'Parent-teacher meeting',
    ]);
    const res = await admin.patch(`/users/${ayaan._id}`, {
      profile: { sectionId: sid(school.sections.pgB) },
    });
    expect(res.status).toBe(200);
    expect(await invitedTo(ayaan)).toEqual([
      'Annual day',
      'Cancelled',
      'Chat about Ayaan',
      'PG-B meeting',
    ]);

    const removed = (await notes(ayaan, 'meeting_updated')).filter((n) => n.data.removed);
    expect(removed.map((n) => n.title)).toEqual(['No longer invited: Parent-teacher meeting']);
    const invites = (await notes(ayaan, 'meeting_invite')).map((n) => n.title);
    expect(invites).toContain('Meeting invitation: PG-B meeting');
    expect(invites.filter((t) => t.includes('PG-B'))).toHaveLength(1);

    // Past and cancelled meetings are untouched.
    expect((await Meeting.findOne({ title: 'Past' })).inviteeStudentIds).toHaveLength(0);
    expect((await Meeting.findOne({ title: 'Cancelled' })).inviteeStudentIds.map(String)).toContain(
      sid(ayaan),
    );
  });

  it('a move within a class-level or multi-section invite keeps the student invited', async () => {
    await admin.post(
      '/meetings',
      meeting(
        { target: 'classes', classIds: [sid(school.classes.playgroup)] },
        { title: 'Playgroup concert' },
      ),
    );
    await admin.post(
      '/meetings',
      meeting(
        { target: 'sections', sectionIds: [sid(school.sections.pgA), sid(school.sections.pgB)] },
        { title: 'Both sections' },
      ),
    );
    await admin.patch(`/users/${nusrat._id}`, { profile: { sectionId: sid(school.sections.pgB) } });
    const titles = await invitedTo(nusrat);
    expect(titles).toEqual(expect.arrayContaining(['Playgroup concert', 'Both sections']));
    const removed = (await notes(nusrat, 'meeting_updated')).filter((n) => n.data.removed);
    expect(removed.map((n) => n.title)).toEqual(['No longer invited: Parent-teacher meeting']);
  });
});

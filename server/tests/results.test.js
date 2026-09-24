import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Assessment, AuditLog, Notification, Result, Settings } from '../src/models/index.js';
import { addDays, toDateKey, todaySchoolDate } from '../src/utils/date.js';
import { assign, createAttendanceSchool } from './helpers/attendance.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { apiAs } from './helpers/school.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

let school;
let farhana;
let admin;
let ayaan;
let nusrat;
let arham;
beforeEach(async () => {
  school = await createAttendanceSchool();
  farhana = apiAs(school.teacher);
  admin = apiAs(school.admin);
  [ayaan, nusrat, arham] = school.students;
  await assign(school, { subject: 'english', days: [school.weekday] });
});

const body = (overrides = {}) => ({
  name: 'Class Test 1',
  type: 'class_test',
  mode: 'marks',
  classId: String(school.classes.playgroup._id),
  sectionId: String(school.sections.pgA._id),
  subjectId: String(school.subjects.english._id),
  totalMarks: 20,
  date: school.dayKey,
  ...overrides,
});
const e = (student, fields) => ({ studentId: String(student._id), ...fields });

async function createWithEntries(entries, overrides = {}, api = farhana) {
  const created = await api.post('/assessments', body(overrides));
  expect(created.status).toBe(201);
  const id = created.body.data._id;
  if (entries) {
    const saved = await api.put(`/results/${id}`, { entries });
    expect(saved.status).toBe(200);
  }
  return id;
}
const fullMarks = () => [
  e(ayaan, { marksObtained: 18 }),
  e(nusrat, { attendance: 'absent' }),
  e(arham, { marksObtained: 12, remarks: 'Good effort' }),
];

describe('assessment scoping', () => {
  it('teachers create only for subjects in their active assignments; admins for any', async () => {
    expect((await farhana.post('/assessments', body())).status).toBe(201);
    const math = body({ subjectId: String(school.subjects.math._id) });
    const denied = await farhana.post('/assessments', math);
    expect(denied.status).toBe(403);
    const byAdmin = await admin.post('/assessments', math);
    expect(byAdmin.status).toBe(201);

    // Teachers list and open only their own subjects' assessments.
    const list = await farhana.get('/assessments');
    expect(list.body.data.map((a) => a.subjectId.name)).toEqual(['English']);
    expect((await farhana.get(`/assessments/${byAdmin.body.data._id}`)).status).toBe(403);
    expect((await apiAs(ayaan).get('/assessments')).status).toBe(403);
  });

  it('marks mode requires totalMarks; results wait for the assessment date', async () => {
    expect((await farhana.post('/assessments', body({ totalMarks: undefined }))).status).toBe(422);
    const future = await farhana.post(
      '/assessments',
      body({ date: toDateKey(addDays(todaySchoolDate(), 2)) }),
    );
    const res = await farhana.put(`/results/${future.body.data._id}`, {
      entries: [e(ayaan, { marksObtained: 10 })],
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/from the assessment date/);
  });
});

describe('entry rules per mode', () => {
  it('marks: grade calculated and stored, marks ≤ total, manual override flagged', async () => {
    const id = await createWithEntries(fullMarks());
    const rows = Object.fromEntries(
      (await Result.find({ assessmentId: id }).lean()).map((r) => [String(r.studentId), r]),
    );
    expect(rows[ayaan._id]).toMatchObject({
      marksObtained: 18,
      percent: 90,
      grade: 'A+',
      gradeOverridden: false,
    });
    expect(rows[arham._id]).toMatchObject({
      marksObtained: 12,
      percent: 60,
      grade: 'A-',
      remarks: 'Good effort',
    });
    expect(rows[nusrat._id]).toMatchObject({ attendance: 'absent' });
    expect(rows[nusrat._id].marksObtained).toBeUndefined();
    expect(rows[nusrat._id].grade).toBeUndefined();

    const tooMany = await farhana.put(`/results/${id}`, {
      entries: [e(ayaan, { marksObtained: 21 })],
    });
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.errors[0].message).toBe('Marks cannot exceed the total of 20');

    const override = await farhana.put(`/results/${id}`, {
      entries: [e(arham, { marksObtained: 12, grade: 'A' })],
    });
    expect(override.status).toBe(200);
    expect(await Result.findOne({ studentId: arham._id }).lean()).toMatchObject({
      grade: 'A',
      gradeOverridden: true,
    });
    const badGrade = await farhana.put(`/results/${id}`, {
      entries: [e(arham, { marksObtained: 12, grade: 'Z' })],
    });
    expect(badGrade.status).toBe(422);
  });

  it('absent/excused students cannot have marks or a grade', async () => {
    const id = await createWithEntries(null);
    const absent = await farhana.put(`/results/${id}`, {
      entries: [e(nusrat, { attendance: 'absent', marksObtained: 0 })],
    });
    expect(absent.status).toBe(422);
    const excused = await farhana.put(`/results/${id}`, {
      entries: [e(nusrat, { attendance: 'excused', grade: 'B' })],
    });
    expect(excused.status).toBe(422);
    const ok = await farhana.put(`/results/${id}`, {
      entries: [e(nusrat, { attendance: 'excused', remarks: 'Family event' })],
    });
    expect(ok.status).toBe(200);
  });

  it('grade mode: the teacher picks a grade; marks are rejected', async () => {
    const id = await createWithEntries(null, { mode: 'grade', totalMarks: undefined });
    expect(
      (await farhana.put(`/results/${id}`, { entries: [e(ayaan, { marksObtained: 10 })] })).status,
    ).toBe(422);
    const ok = await farhana.put(`/results/${id}`, {
      entries: [
        e(ayaan, { grade: 'A' }),
        e(nusrat, { grade: 'B' }),
        e(arham, { attendance: 'excused' }),
      ],
    });
    expect(ok.status).toBe(200);
    expect((await farhana.patch(`/assessments/${id}/publish`)).status).toBe(200);
  });

  it('remarks mode: feedback only, required for present students at publish', async () => {
    const id = await createWithEntries(
      [
        e(ayaan, { remarks: 'Needs improvement in fine motor skills' }),
        e(nusrat, {}),
        e(arham, { attendance: 'absent' }),
      ],
      { mode: 'remarks', totalMarks: undefined, subjectId: String(school.subjects.english._id) },
    );
    expect(
      (await farhana.put(`/results/${id}`, { entries: [e(ayaan, { grade: 'A' })] })).status,
    ).toBe(422);
    const blocked = await farhana.patch(`/assessments/${id}/publish`);
    expect(blocked.status).toBe(422);
    expect(blocked.body.errors.map((x) => x.message)).toEqual([
      'Nusrat Jahan (roll 2): remarks missing',
    ]);
  });
});

describe('publishing', () => {
  it('is blocked (422) while any enrolled student lacks a complete entry', async () => {
    const id = await createWithEntries([e(ayaan, { marksObtained: 18 }), e(nusrat, {})]);
    const res = await farhana.patch(`/assessments/${id}/publish`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('RESULTS_INCOMPLETE');
    expect(res.body.errors.map((x) => x.message)).toEqual([
      'Nusrat Jahan (roll 2): marks missing',
      'Arham Hossain (roll 3): no entry',
    ]);
    // Structured for the UI (highlighting rows): one item per student, with the id.
    expect(res.body.details.students).toEqual([
      expect.objectContaining({ name: 'Nusrat Jahan', rollNo: 2, problem: 'marks missing' }),
      expect.objectContaining({ name: 'Arham Hossain', rollNo: 3, problem: 'no entry' }),
    ]);
    expect(res.body.details.students.every((x) => /^[a-f0-9]{24}$/.test(x.studentId))).toBe(true);
    expect((await Assessment.findById(id)).status).toBe('draft');
  });

  it('publishes in one go: snapshot, ONE notification per student, then locked', async () => {
    const id = await createWithEntries(fullMarks());
    const res = await farhana.patch(`/assessments/${id}/publish`);
    expect(res.status).toBe(200);
    expect(res.body.data.students).toBe(3);

    const assessment = await Assessment.findById(id).lean();
    expect(assessment).toMatchObject({ status: 'published', publishedBy: school.teacher._id });
    expect(assessment.gradingScale.map((b) => b.grade)).toContain('A+');

    for (const student of [ayaan, nusrat, arham]) {
      expect(
        await Notification.countDocuments({ recipientId: student._id, type: 'result_published' }),
      ).toBe(1);
    }
    const [n] = await Notification.find({ recipientId: nusrat._id }).lean();
    expect(n.message).toBe('Class Test 1 (English): marked absent.');
    const [a] = await Notification.find({ recipientId: ayaan._id }).lean();
    expect(a.message).toBe('Class Test 1 (English): 18/20, grade A+.');

    expect((await farhana.patch(`/assessments/${id}/publish`)).status).toBe(409);
    const draftEdit = await farhana.put(`/results/${id}`, {
      entries: [e(ayaan, { marksObtained: 1 })],
    });
    expect(draftEdit.status).toBe(409);
    expect(draftEdit.body.code).toBe('ASSESSMENT_PUBLISHED');
    expect((await farhana.delete(`/assessments/${id}`)).status).toBe(409);
  });
});

describe('students only ever see published results', () => {
  it('drafts are invisible; published results appear; others are 403', async () => {
    const id = await createWithEntries(fullMarks());
    const mine = () => apiAs(ayaan).get(`/results/student/${ayaan._id}`);
    expect((await mine()).body.data).toEqual([]);

    await farhana.patch(`/assessments/${id}/publish`);
    const after = (await mine()).body.data;
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ grade: 'A+', marksObtained: 18, subject: 'English' });

    // A second draft never leaks, even via the teacher/admin path of the same endpoint.
    await createWithEntries(fullMarks(), { name: 'Class Test 2' });
    expect((await mine()).body.data).toHaveLength(1);
    expect((await admin.get(`/results/student/${ayaan._id}`)).body.data).toHaveLength(1);
    expect((await apiAs(nusrat).get(`/results/student/${ayaan._id}`)).status).toBe(404);
  });

  it('one test by assessmentId, with its saved scale; a draft id returns nothing', async () => {
    const published = await createWithEntries(fullMarks());
    await farhana.patch(`/assessments/${published}/publish`);
    const draft = await createWithEntries(fullMarks(), { name: 'Class Test 2' });
    // Changing the school scale later does not change the published test's scale.
    await Settings.updateOne({}, { gradingScale: [{ grade: 'Pass', minPercent: 0 }] });

    const one = (id) => apiAs(ayaan).get(`/results/student/${ayaan._id}?assessmentId=${id}`);
    const [row] = (await one(published)).body.data;
    expect(row.subjectId).toBe(String(school.subjects.english._id));
    expect(row.assessment._id).toBe(published);
    expect(row.assessment.gradingScale[0]).toMatchObject({ grade: 'A+', minPercent: 80 });
    expect((await one(draft)).body.data).toEqual([]);
  });
});

describe('editing published results', () => {
  let id;
  beforeEach(async () => {
    id = await createWithEntries(fullMarks());
    await farhana.patch(`/assessments/${id}/publish`);
  });
  const resultOf = (student) => Result.findOne({ assessmentId: id, studentId: student._id }).lean();

  it('needs a reason; audits before/after; notifies the student', async () => {
    const r = await resultOf(arham);
    expect((await farhana.patch(`/results/${r._id}`, { marksObtained: 15 })).status).toBe(422);

    const res = await farhana.patch(`/results/${r._id}`, {
      marksObtained: 15,
      reason: 'Re-marked question 3',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ marksObtained: 15, percent: 75, grade: 'A' });

    const audit = await AuditLog.findOne({ action: 'result.update' }).lean();
    expect(audit.changes).toMatchObject({
      before: { marksObtained: 12, grade: 'A-' },
      after: { marksObtained: 15, grade: 'A', reason: 'Re-marked question 3' },
    });
    const updates = await Notification.find({
      recipientId: arham._id,
      type: 'result_updated',
    }).lean();
    expect(updates).toHaveLength(1);
    expect(updates[0].message).toMatch(/15\/20, grade A/);
  });

  it('teachers only for their own subjects; admins override (audited as override)', async () => {
    const r = await resultOf(ayaan);
    const other = await apiAs(school.secondTeacher).patch(`/results/${r._id}`, {
      remarks: 'x',
      reason: 'Not mine',
    });
    expect(other.status).toBe(403);
    const byAdmin = await admin.patch(`/results/${r._id}`, {
      attendance: 'excused',
      reason: 'Medical certificate received',
    });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.data.marksObtained).toBeUndefined();
    const audit = await AuditLog.findOne({ action: 'result.override' }).lean();
    expect(audit.changes.after).toMatchObject({ attendance: 'excused', override: true });
  });

  it('stored grades survive a grading-scale change; later edits use the snapshot', async () => {
    // Make the scale much stricter after publishing.
    await Settings.updateOne(
      {},
      {
        gradingScale: [
          { grade: 'A+', minPercent: 95 },
          { grade: 'A', minPercent: 85 },
          { grade: 'B', minPercent: 50 },
          { grade: 'F', minPercent: 0 },
        ],
      },
    );
    expect((await resultOf(ayaan)).grade).toBe('A+'); // 90% stays A+
    expect((await apiAs(ayaan).get(`/results/student/${ayaan._id}`)).body.data[0].grade).toBe('A+');

    // 17/20 = 85%: the new scale would say A, the publish-time snapshot says A+.
    const res = await farhana.patch(`/results/${(await resultOf(ayaan))._id}`, {
      marksObtained: 17,
      reason: 'Arithmetic slip',
    });
    expect(res.body.data).toMatchObject({ percent: 85, grade: 'A+' });
  });
});

describe('draft assessment edits', () => {
  it('totalMarks cannot go below an existing mark; a new total regrades drafts', async () => {
    const id = await createWithEntries(fullMarks());
    expect((await farhana.patch(`/assessments/${id}`, { totalMarks: 15 })).status).toBe(422);
    const res = await farhana.patch(`/assessments/${id}`, { totalMarks: 40 });
    expect(res.status).toBe(200);
    expect(await Result.findOne({ studentId: ayaan._id }).lean()).toMatchObject({
      percent: 45,
      grade: 'C',
    });
  });
});

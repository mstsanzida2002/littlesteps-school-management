// Real saves of school-wide settings (project "admin-mutations": runs after every other e2e spec,
// one worker, so it can't disturb them). It changes the grading scale, the off days and the
// active school year, and checks what each change does to others.
import { expect, test } from '@playwright/test';

import { apiAs, login, markableDay, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

let ids;

test.beforeAll(async ({ request }) => {
  // The `request` fixture from beforeAll can't be reused inside a test, so this API client is
  // only for finding the fixed ids below; each test builds its own from its own `request`.
  const setup = await apiAs(request, USERS.admin);
  const classes = (await setup.get('/classes?limit=50')).body.data;
  const pg = classes.find((c) => c.name === 'Playgroup');
  const sectionA = (await setup.get(`/sections?classId=${pg._id}`)).body.data.find(
    (s) => s.name === 'A',
  );
  const english = (await setup.get('/subjects?limit=50')).body.data.find(
    (s) => s.name === 'English',
  );
  ids = { classId: pg._id, sectionId: sectionA._id, subjectId: english._id };
});

test('a saved grading scale grades new results; published ones keep their saved grades', async ({
  page,
  request,
}) => {
  const admin = await apiAs(request, USERS.admin);
  // Before: a published result graded A+ at 80–89% under the seeded scale.
  const published = (
    await admin.get(
      `/assessments?status=published&classId=${ids.classId}&sectionId=${ids.sectionId}&subjectId=${ids.subjectId}`,
    )
  ).body.data[0];
  const before = (await admin.get(`/assessments/${published._id}`)).body.data;
  const kept = before.students.find(
    (s) => s.result?.percent >= 80 && s.result?.percent < 90 && s.result?.grade === 'A+',
  );

  await login(page, USERS.admin);
  await page.goto('/admin/settings');
  await page.getByLabel('Grade 1 starts at (%)').fill('90'); // A+ now from 90%
  await page.getByRole('button', { name: 'Save grading scale' }).click();
  await expect(page.getByText(/Grading scale saved/)).toBeVisible();

  // A test published now uses the new scale: 85% is an A, no longer an A+.
  const settings = (await admin.get('/settings/school')).body.data;
  const created = await admin.post('/assessments', {
    name: 'Scale check',
    type: 'class_test',
    mode: 'marks',
    ...ids,
    totalMarks: 20,
    date: markableDay(settings),
  });
  expect(created.status).toBe(201);
  const test_ = created.body.data;
  const entries = test_.students.map((s) => ({
    studentId: s.studentId,
    attendance: 'present',
    marksObtained: 17,
  }));
  expect((await admin.put(`/results/${test_._id}`, { entries })).status).toBe(200);
  expect((await admin.patch(`/assessments/${test_._id}/publish`)).status).toBe(200);
  const fresh = (await admin.get(`/assessments/${test_._id}`)).body.data;
  expect(new Set(fresh.students.map((s) => s.result.grade))).toEqual(new Set(['A']));
  expect(fresh.gradingScale[0]).toMatchObject({ grade: 'A+', minPercent: 90 });

  // The older published test is unchanged.
  const after = (await admin.get(`/assessments/${published._id}`)).body.data;
  expect(after.gradingScale[0]).toMatchObject({ grade: 'A+', minPercent: 80 });
  if (kept) {
    const same = after.students.find((s) => s.studentId === kept.studentId);
    expect(same.result.grade).toBe('A+');
  }
});

test('a saved off day: teachers can no longer pick it', async ({ page, browser, request }) => {
  const admin = await apiAs(request, USERS.admin);
  await login(page, USERS.admin);
  await page.goto('/admin/settings');
  await page.getByLabel('Thursday', { exact: true }).check();
  await page.getByRole('button', { name: 'Save attendance rules' }).click();
  await expect(page.getByText('Attendance rules saved')).toBeVisible();
  const settings = (await admin.get('/settings/school')).body.data;
  expect(settings.weeklyOffDays).toContain('thursday');

  const teacher = await (await browser.newContext()).newPage();
  await login(teacher, USERS.farhana);
  await teacher.goto('/teacher/attendance');
  const chips = teacher.getByRole('group', { name: 'Day' }).getByRole('radio');
  await expect(chips.first()).toBeVisible();
  for (const label of await chips.allInnerTexts()) expect(label).not.toMatch(/Thu/);
});

test('switching the school year (typed confirmation): teachers start from an empty year', async ({
  page,
  browser,
  request,
}) => {
  const admin = await apiAs(request, USERS.admin);
  const created = await admin.post('/sessions', {
    name: '2027',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
  });
  expect(created.status).toBe(201);

  await login(page, USERS.admin);
  await page.goto('/admin/classes?tab=years');
  await page
    .getByRole('row', { name: /2027/ })
    .getByRole('button', { name: 'Make active' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Switch to 2027?' });
  await dialog.getByRole('textbox').fill('2027');
  await dialog.getByRole('button', { name: 'Switch school year' }).click();
  await expect(page.getByText('2027 is now the active school year')).toBeVisible();
  await expect(page.getByRole('row', { name: /2027/ })).toContainText('Active');

  // A teacher now has no classes in the new year (no assignments yet).
  const teacher = await (await browser.newContext()).newPage();
  await login(teacher, USERS.farhana);
  await expect(
    teacher.getByText(/No classes today|Nothing on your timetable today/).first(),
  ).toBeVisible();
});

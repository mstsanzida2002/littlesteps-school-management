// Attendance override (FR-ADM-09). Owns kg2-b-03's (Afia Ibnat) attendance on one school day
// older than the teachers' backdate limit.
import { expect, test } from '@playwright/test';

import { addDays, apiAs, dayLabel, login, markableDay, studentLogin, USERS } from './helpers.js';

const CHILD = { name: 'Afia Ibnat', username: 'kg2-b-03' };
const REASON = 'Medical note brought in by the guardian';
let target;

test.beforeAll(async ({ request }) => {
  const admin = await apiAs(request, USERS.admin);
  const settings = (await admin.get('/settings/school')).body.data;
  // Ten school days back: beyond a teacher's 7-day limit, inside the seeded 30 days.
  let day = markableDay(settings);
  for (let n = 0; n < 10;) {
    day = addDays(day, -1);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (![5, 6].includes(weekday)) n += 1;
  }
  const classes = (await admin.get('/classes?limit=50')).body.data;
  const kg2 = classes.find((c) => c.name === 'KG-2');
  const section = (await admin.get(`/sections?classId=${kg2._id}`)).body.data.find(
    (s) => s.name === 'B',
  );
  const sheet = (
    await admin.get(`/attendance/class-sections/${kg2._id}/${section._id}/sheet?date=${day}`)
  ).body.data;
  const me = sheet.students.find((s) => s.name === CHILD.name);
  const records = sheet.records.filter((r) => String(r.studentId) === String(me.studentId));
  expect(records.length).toBeGreaterThan(0);
  // Change to whatever the day is not already, so there is always something to change.
  const allAbsent = records.every((r) => r.status === 'absent');
  target = {
    day,
    classId: kg2._id,
    sectionId: section._id,
    status: allAbsent ? 'Present' : 'Absent',
    dayStatus: allAbsent ? 'Present' : 'Absent',
  };
});

test('an override of an old day reaches the guardian’s calendar and the audit log', async ({
  page,
  browser,
}) => {
  await login(page, USERS.admin);
  await page.goto(
    `/admin/attendance?classId=${target.classId}&sectionId=${target.sectionId}&date=${target.day}`,
  );
  const row = page.getByRole('row', { name: new RegExp(CHILD.name) });
  await row.getByRole('button', { name: 'Whole day' }).click();
  const dialog = page.getByRole('dialog', { name: 'Override the whole day' });
  await expect(dialog).toContainText('Admin override');
  await dialog.getByText(target.status, { exact: true }).click();
  await dialog.getByLabel('Reason for the override').fill(REASON);
  await dialog.getByRole('button', { name: 'Save change' }).click();
  await expect(page.getByText(/Updated \d+ record/)).toBeVisible();

  // The guardian's calendar shows the day with the new status.
  const guardian = await (await browser.newContext()).newPage();
  await login(guardian, studentLogin(CHILD.username));
  await guardian.goto(`/student/attendance?month=${target.day.slice(0, 7)}`);
  await expect(
    guardian.getByRole('button', { name: `${dayLabel(target.day)}: ${target.dayStatus}` }),
  ).toBeVisible();

  // The audit log names it as an admin override, with the reason.
  await page.goto('/admin/audit-log?action=attendance.override');
  const entry = page.getByRole('row', { name: /Overrode attendance \(admin\)/ }).first();
  await expect(entry).toContainText('Critical');
  await entry.getByRole('button', { name: 'Before / after' }).click();
  const drawer = page.getByRole('dialog', { name: 'Overrode attendance (admin)' });
  await expect(drawer).toContainText(REASON);
  await expect(drawer).toContainText(target.day);
});

// Teacher attendance flows (FR-TCH-03…07, FR-NOT-01). Owns Playgroup (A and B) and farhana.akter.
import { expect, test } from '@playwright/test';

import { apiAs, login, studentLogin, trackPageErrors, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const ABSENT = { name: 'Arham Hossain', username: 'pg-a-03' };
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const addDays = (key, n) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const isOff = (key, offDays) =>
  offDays.includes(WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()]);

let school; // { day: the e2e seed's unmarked school day, classId, sectionId, sectionB, oldDay }

test.beforeAll(async ({ request }) => {
  const teacher = await apiAs(request, USERS.farhana);
  const settings = (await teacher.get('/settings/school')).body.data;
  let day = settings.today;
  while (isOff(day, settings.weeklyOffDays)) day = addDays(day, -1);
  let oldDay = addDays(settings.today, -(settings.attendanceBackdateDays + 3));
  while (isOff(oldDay, settings.weeklyOffDays)) oldDay = addDays(oldDay, -1);
  const mine = (await teacher.get('/teacher-assignments/mine')).body.data.classSections;
  const pgA = mine.find((cs) => cs.label === 'Playgroup-A');
  const pgB = mine.find((cs) => cs.label === 'Playgroup-B');
  school = { day, oldDay, classId: pgA.classId, sectionId: pgA.sectionId, sectionB: pgB.sectionId };
});

const absenceCount = async (request) => {
  const guardian = await apiAs(request, studentLogin(ABSENT.username));
  const { body } = await guardian.get('/notifications?type=absence&limit=100');
  return body.data.filter((n) => n.data?.date === school.day).length;
};

test('take attendance with one absent → the guardian gets one notification', async ({
  page,
  browser,
  request,
}) => {
  const errors = trackPageErrors(page);
  expect(await absenceCount(request)).toBe(0);

  await login(page, USERS.farhana);
  await page.goto(`/teacher/attendance?classId=${school.classId}&sectionId=${school.sectionId}`);

  // The first chip is the default day and is highlighted.
  const chips = page.getByRole('group', { name: 'Day' });
  await expect(chips.getByRole('radio').first()).toBeChecked();

  // Everyone starts present; one tap marks Arham absent.
  const counts = page.getByText(/\d+ present · \d+ absent · \d+ late/);
  await expect(counts).toHaveText('5 present · 0 absent · 0 late');
  await page.getByRole('radiogroup', { name: ABSENT.name }).getByText('Absent').click();
  await expect(counts).toHaveText('4 present · 1 absent · 0 late');

  // The confirmation lists the absent student.
  await page.getByRole('button', { name: 'Submit' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(ABSENT.name);
  await expect(dialog).toContainText('4 present · 1 absent · 0 late');
  const submit = dialog.getByRole('button', { name: 'Submit attendance' });
  await submit.click();
  await expect(page.getByText('Saved for Playgroup-A', { exact: true })).toBeVisible();

  // Exactly one absence notification for that day, visible to the guardian.
  expect(await absenceCount(request)).toBe(1);
  const guardianContext = await browser.newContext();
  const guardianPage = await guardianContext.newPage();
  await login(guardianPage, studentLogin(ABSENT.username));
  await guardianPage.goto('/student/notifications');
  await expect(guardianPage.getByRole('button', { name: /Absent on/ })).toHaveCount(1);
  await guardianContext.close();
  expect(errors).toEqual([]);
});

test('the same day again: "Already taken — view or edit"', async ({ page }) => {
  await login(page, USERS.farhana);
  await page.goto(
    `/teacher/attendance?classId=${school.classId}&sectionId=${school.sectionId}&date=${school.day}`,
  );
  await expect(page.getByText('Already taken — view or edit')).toBeVisible();
  await page.getByRole('link', { name: 'View or edit attendance' }).click();
  await expect(page).toHaveURL(/\/teacher\/attendance\/records/);
  await expect(page.getByRole('heading', { name: 'Attendance records' })).toBeVisible();
});

test('edit one record with a reason', async ({ page, request }) => {
  const guardian = await apiAs(request, studentLogin(ABSENT.username));
  const corrections = async () =>
    (await guardian.get('/notifications?type=attendance_corrected&limit=100')).body.data.length;
  const before = await corrections();

  await login(page, USERS.farhana);
  await page.goto(
    `/teacher/attendance/records?classId=${school.classId}&sectionId=${school.sectionId}&date=${school.day}`,
  );
  const row = page.getByRole('row').filter({ hasText: ABSENT.name });
  await row.getByRole('button', { name: 'Change English: absent' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Change attendance' })).toBeVisible();
  // The reason is required.
  await dialog.getByText('Present', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Save change' }).click();
  await expect(dialog.getByText('Give a reason (at least 3 characters)')).toBeVisible();
  await dialog.getByLabel('Reason for the change').fill('Arrived after the register was taken');
  await dialog.getByRole('button', { name: 'Save change' }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByRole('button', { name: 'Change English: present' })).toBeVisible();

  await expect.poll(corrections).toBe(before + 1);
});

test('leaving with unsaved statuses asks first', async ({ page }) => {
  await login(page, USERS.farhana);
  await page.goto(
    `/teacher/attendance?classId=${school.classId}&sectionId=${school.sectionB}&date=${school.day}`,
  );
  await page.getByRole('radiogroup').first().getByText('Late').click();
  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Leave without saving?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay on this page' }).click();
  await expect(page).toHaveURL(/\/teacher\/attendance\?/);
  await expect(page.getByText(/4 present · 0 absent · 1 late/)).toBeVisible();
});

test('older than the backdate limit: view only, an admin can change it', async ({ page }) => {
  await login(page, USERS.farhana);
  await page.goto(
    `/teacher/attendance/records?classId=${school.classId}&sectionId=${school.sectionId}&date=${school.oldDay}`,
  );
  await expect(page.getByText('An administrator can make this change for you.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Whole day' })).toHaveCount(0);
});

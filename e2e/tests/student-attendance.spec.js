// Guardian attendance (FR-STU-02…04, FR-NOT-01). Owns Nursery-A attendance on the unmarked day
// (nasrin.sultana marks it) and nur-a-02, Tasnim Ara Oishi, called "Oishi" at home.
import { expect, test } from '@playwright/test';

import {
  apiAs,
  dayLabel,
  login,
  markableDay,
  studentLogin,
  trackPageErrors,
  USERS,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const CHILD = { name: 'Tasnim Ara Oishi', nickname: 'Oishi', username: 'nur-a-02' };
let day;

test.beforeAll(async ({ request }) => {
  const teacher = await apiAs(request, USERS.nasrin);
  day = markableDay((await teacher.get('/settings/school')).body.data);
});

test('a teacher marks Oishi absent → the guardian sees the alert on home and the calendar', async ({
  page,
  browser,
}) => {
  const errors = trackPageErrors(page);

  // The teacher takes attendance for Nursery-A with one absence.
  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await login(teacherPage, USERS.nasrin);
  await teacherPage.goto('/teacher/attendance');
  await teacherPage.getByLabel('Class').selectOption({ label: 'Nursery-A' });
  await teacherPage.getByRole('radiogroup', { name: CHILD.name }).getByText('Absent').click();
  await teacherPage.getByRole('button', { name: 'Submit' }).click();
  await teacherPage.getByRole('dialog').getByRole('button', { name: 'Submit attendance' }).click();
  await expect(teacherPage.getByText('Saved for Nursery-A', { exact: true })).toBeVisible();
  await teacherContext.close();

  // The guardian's home page: the alert calls the child by her nickname and lists the subjects.
  await login(page, studentLogin(CHILD.username));
  await expect(page.getByRole('heading', { level: 1, name: 'Oishi at a glance' })).toBeVisible();
  const alerts = page.getByRole('region', { name: 'Absence alerts' });
  const alert = alerts.getByRole('link', {
    name: new RegExp(`Oishi was absent on ${dayLabel(day)}`),
  });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Missed:');

  // It opens that day on the calendar: the day is Absent, with each subject and teacher.
  await alert.click();
  await expect(page).toHaveURL(
    new RegExp(`/student/attendance\\?month=${day.slice(0, 7)}&day=${day}`),
  );
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Absent').first()).toBeVisible();
  await expect(sheet).toContainText('with Nasrin Sultana');
  await sheet.getByRole('button', { name: 'Close' }).first().click();
  await expect(page.getByRole('button', { name: `${dayLabel(day)}: Absent` })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(errors).toEqual([]);
});

test('the calendar moves between months and explains each colour', async ({ page }) => {
  await login(page, studentLogin(CHILD.username));
  await page.goto('/student/attendance');
  const month = page.getByRole('list', { name: /\w+ \d{4}/ });
  const title = await month.getAttribute('aria-label');
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('list', { name: /\w+ \d{4}/ })).not.toHaveAttribute(
    'aria-label',
    title,
  );
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('list', { name: title })).toBeVisible();
  // Can't go past this month.
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();

  await page.getByText('What the colours and icons mean').click();
  const legend = page.locator('details', { hasText: 'What the colours and icons mean' });
  for (const label of ['Present', 'Late', 'Part of the day', 'Absent', 'No class', 'Off day']) {
    await expect(legend.getByText(label, { exact: true })).toBeVisible();
  }
});

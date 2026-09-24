// Meetings (FR-TCH-13/14). Owns KG-2-A and shirin.akhter.
import { expect, test } from '@playwright/test';

import { apiAs, login, studentLogin, trackPageErrors, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const TITLE = 'KG-2-A reading evening';

test('create a meeting for my class → guardians are invited', async ({ page, request }) => {
  const errors = trackPageErrors(page);
  const teacher = await apiAs(request, USERS.shirin);
  const { today } = (await teacher.get('/settings/school')).body.data;
  const inTwoDays = new Date(Date.parse(`${today}T00:00:00Z`) + 2 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  await login(page, USERS.shirin);
  await page.goto('/teacher/meetings');
  await page.getByRole('link', { name: 'New meeting' }).first().click();
  await expect(page.getByRole('heading', { name: 'New meeting' })).toBeVisible();

  // Validation first.
  await page.getByRole('button', { name: 'Create and invite' }).click();
  await expect(page.getByText('At least 3 characters')).toBeVisible();

  await page.getByLabel('Title').fill(TITLE);
  await page.getByLabel('Date').fill(inTwoDays);
  await page.getByLabel('Time').fill('16:30');
  await page.getByLabel('Venue').fill('KG-2 classroom');
  await page.getByLabel('KG-2-A').check();
  await page.getByRole('button', { name: 'Create and invite' }).click();

  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
  await expect(page.getByText('Upcoming').first()).toBeVisible();
  const replies = page.getByRole('list', { name: 'Replies', exact: true });
  await expect(replies).toContainText('No response');
  await expect(replies.getByRole('listitem').last()).toContainText('5');

  const guardian = await apiAs(request, studentLogin('kg2-a-01'));
  const invites = (await guardian.get('/notifications?type=meeting_invite&limit=50')).body.data;
  expect(invites.filter((n) => n.title.includes(TITLE))).toHaveLength(1);

  await page.getByRole('link', { name: 'All meetings' }).click();
  await expect(page.getByRole('link', { name: new RegExp(TITLE) })).toBeVisible();
  expect(errors).toEqual([]);
});

test('cancel it with a reason', async ({ page }) => {
  await login(page, USERS.shirin);
  await page.goto('/teacher/meetings');
  await page.getByRole('link', { name: new RegExp(TITLE) }).click();
  await page.getByRole('button', { name: 'Cancel meeting' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reason').fill('Moved to next month');
  await dialog.getByRole('button', { name: 'Cancel meeting' }).click();
  await expect(page.getByText('Moved to next month')).toBeVisible();
  await expect(page.getByText('Cancelled').first()).toBeVisible();
});

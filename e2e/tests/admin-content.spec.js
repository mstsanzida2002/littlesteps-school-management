// Admin meetings and notices (FR-ADM-07/08). Owns a staff-only meeting inviting nasrin.sultana
// and a teachers-only notice (a guardian notice would disturb notifications.spec).
import { expect, test } from '@playwright/test';

import { addDays, apiAs, login, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const MEETING = 'Staff planning: winter term';
const NOTICE = 'Staff room closed on Thursday';

test('a staff-only meeting: create, see replies, cancel with a reason', async ({
  page,
  request,
}) => {
  const admin = await apiAs(request, USERS.admin);
  const { today } = (await admin.get('/settings/school')).body.data;
  await login(page, USERS.admin);
  await page.goto('/admin/meetings/new');
  await page.getByLabel('Title').fill(MEETING);
  await page.getByLabel('Date').fill(addDays(today, 4));
  await page.getByLabel('Time').fill('14:00');
  await page.getByLabel('Venue').fill('Staff room');
  await page.getByLabel('Staff only').check();
  await page.getByRole('button', { name: 'Create and invite' }).click();
  await expect(page.getByText('Choose at least one teacher')).toBeVisible();
  await page.getByLabel('Nasrin Sultana').check();
  await page.getByRole('button', { name: 'Create and invite' }).click();
  await expect(page.getByRole('heading', { level: 1, name: MEETING })).toBeVisible();

  // The invited teacher sees it.
  const nasrin = await apiAs(request, USERS.nasrin);
  const theirs = (await nasrin.get('/meetings?when=upcoming&limit=50')).body.data;
  expect(theirs.some((m) => m.title === MEETING)).toBe(true);

  await page.getByRole('button', { name: 'Cancel meeting' }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Moved online');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel meeting' }).click();
  await expect(page.getByText('Moved online')).toBeVisible();
});

test('a notice: draft with a guardian preview, publish to teachers, pin, expire, delete', async ({
  page,
  request,
}) => {
  await login(page, USERS.admin);
  await page.goto('/admin/notices/new');
  const preview = page.getByRole('region', { name: 'How guardians will see it' });
  await expect(preview).toContainText('Your title');
  await page.getByLabel('Title').fill(NOTICE);
  await page
    .getByRole('textbox', { name: /^Notice/ })
    .fill('Painting work. Please use the library.');
  await expect(preview).toContainText(NOTICE);
  await page.getByRole('radio', { name: /^Teachers/ }).check();
  await expect(preview).toContainText("Guardians won't see this notice");
  await page.getByRole('button', { name: 'Save as draft' }).click();
  await expect(page).toHaveURL(/\/admin\/notices$/);

  const row = page.getByRole('article', { name: NOTICE });
  await expect(row).toContainText('Draft');
  await row.getByRole('button', { name: 'Publish' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(row).toContainText('Published');

  const nasrin = await apiAs(request, USERS.nasrin);
  const seen = (await nasrin.get('/notices?limit=50')).body.data;
  expect(seen.some((n) => n.title === NOTICE)).toBe(true);

  await row.getByRole('button', { name: 'Pin' }).click();
  await expect(row).toContainText('Pinned');
  await row.getByRole('button', { name: 'Expire' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Expire now' }).click();
  await expect(row).toHaveCount(0); // expired notices leave the live list
  await page.getByRole('tab', { name: 'Expired' }).click();
  const expired = page.getByRole('article', { name: NOTICE });
  await expect(expired).toContainText('Expired');
  await expired.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('article', { name: NOTICE })).toHaveCount(0);
});

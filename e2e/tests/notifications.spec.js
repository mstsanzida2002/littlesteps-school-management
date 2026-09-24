// Notifications page (FR-NOT-03/04), shared by every role. Owns the guardian nur-b-01.
import { expect, test } from '@playwright/test';

import { login, studentLogin } from './helpers.js';

test('open one (it is marked read and leads to its screen), then mark all read', async ({
  page,
}) => {
  await login(page, studentLogin('nur-b-01'));
  await page.getByRole('link', { name: /unread notification/ }).click();
  await expect(page).toHaveURL(/\/student\/notifications$/);

  // Opening a notice notification marks it read and goes to the notices page.
  await page
    .getByRole('button', { name: /Unread: Notice:/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/student\/notices$/);
  await expect(page.getByRole('heading', { name: 'Notices' })).toBeVisible();

  await page.goBack();
  await page.getByRole('tab', { name: 'Unread' }).click();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByText('All caught up')).toBeVisible();
  await expect(page.getByRole('img', { name: 'No unread notifications' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'No unread notifications' })).toBeVisible();
});

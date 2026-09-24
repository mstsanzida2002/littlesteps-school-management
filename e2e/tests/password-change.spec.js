// An admin-created account must choose its own password before using the app.
import { expect, test } from '@playwright/test';

import { apiAs, API_URL, trackPageErrors, USERS } from './helpers.js';

test('forced password change for a new teacher', async ({ page, request }) => {
  const errors = trackPageErrors(page);
  const admin = await apiAs(request, USERS.admin);
  const created = await admin.post('/users', {
    role: 'teacher',
    name: 'Browser Check Teacher',
    username: 'e2e.newteacher',
    password: 'Temp2026x',
    profile: { employeeId: 'T-E2E' },
  });
  expect(created.status).toBe(201);
  expect(created.body.data.mustChangePassword).toBe(true);

  await page.goto('/login');
  await page.locator('#identifier').fill('e2e.newteacher');
  await page.locator('#password').fill('Temp2026x');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByText('Your password was set by the school')).toBeVisible();

  // Every other page is blocked until the password changes.
  await page.goto('/teacher');
  await expect(page).toHaveURL(/\/change-password$/);

  // The policy is checked before sending, on the field.
  await page.locator('#currentPassword').fill('Temp2026x');
  await page.locator('#newPassword').fill('short');
  await page.locator('#confirmPassword').fill('short');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();

  // The server's own check lands on the right field too (wrong current password).
  await page.locator('#currentPassword').fill('NotTheOne1');
  await page.locator('#newPassword').fill('MyOwnPass1');
  await page.locator('#confirmPassword').fill('MyOwnPass1');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByText('Current password is incorrect')).toBeVisible();
  await expect(page.locator('#currentPassword')).toHaveAttribute('aria-invalid', 'true');

  await page.locator('#currentPassword').fill('Temp2026x');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await page.reload();
  await expect(page).toHaveURL(/\/teacher$/);

  const relogin = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: 'e2e.newteacher', password: 'MyOwnPass1' },
  });
  expect((await relogin.json()).data.user.mustChangePassword).toBe(false);
  expect(errors).toEqual([]);
});

// "Switch child" on a shared phone (read-only: sessions and this browser's storage only).
// Uses kg2-b-01 (Ramisa Anjum, called "Rimi") and kg2-b-04 (Shoaib Akhtar, no nickname).
import { expect, test } from '@playwright/test';

import { login, studentLogin } from './helpers.js';

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test('switch child offers the previous child by name; one tap fills the username', async ({
  page,
}) => {
  await login(page, studentLogin('kg2-b-01'));
  // Whose account is open stays in the header on every screen.
  const header = page.getByRole('banner');
  await expect(header).toContainText('Ramisa Anjum');
  await page.goto('/student/results');
  await expect(header).toContainText('Ramisa Anjum');

  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Switch child' }).click();
  await expect(page).toHaveURL(/\/login\?switch=1$/);

  // The chip shows the child's name (nickname) and username, never a password.
  const chip = page.getByRole('button', { name: 'Rimi (kg2-b-01)', exact: true });
  await expect(chip).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('littlesteps.accounts'));
  expect(JSON.parse(stored)).toEqual([{ username: 'kg2-b-01', name: 'Rimi' }]);
  expect(stored).not.toMatch(/Student@1234|token|password/i);

  // Another child logs in on the same phone; both are offered next time, newest first.
  await page.locator('#identifier').fill('kg2-b-04');
  await page.locator('#password').fill('Student@1234');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Shoaib at a glance' })).toBeVisible();
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Switch child' }).click();
  const chips = page.getByRole('region', { name: 'Choose a child' }).getByRole('listitem');
  await expect(chips).toHaveText([/Shoaib \(kg2-b-04\)/, /Rimi \(kg2-b-01\)/]);

  // One tap: the username is filled and the password box is ready.
  await page.getByRole('button', { name: 'Rimi (kg2-b-01)', exact: true }).click();
  await expect(page.locator('#identifier')).toHaveValue('kg2-b-01');
  await expect(page.locator('#password')).toBeFocused();
  await page.locator('#password').fill('Student@1234');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rimi at a glance' })).toBeVisible();
});

test('"Remove from this device" forgets both the name and the username', async ({ page }) => {
  await login(page, studentLogin('kg2-b-04'));
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Switch child' }).click();

  await page.getByRole('button', { name: 'Remove Shoaib (kg2-b-04) from this device' }).click();
  await expect(page.getByRole('button', { name: 'Shoaib (kg2-b-04)', exact: true })).toHaveCount(0);
  const stored = await page.evaluate(() => localStorage.getItem('littlesteps.accounts'));
  expect(stored ?? '').not.toContain('kg2-b-04');
  expect(stored ?? '').not.toContain('Shoaib');
});

test('staff accounts are not remembered', async ({ page }) => {
  await login(page, { identifier: 'shirin.akhter', password: 'Teacher@1234' });
  const stored = await page.evaluate(() => localStorage.getItem('littlesteps.accounts'));
  expect(stored).toBeNull();
});

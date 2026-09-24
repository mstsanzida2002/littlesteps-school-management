// Keyboard and focus behaviour of the shell and shared components (read-only).
import { expect, test } from '@playwright/test';

import { login, USERS } from './helpers.js';

test.use({ reducedMotion: 'reduce' });

test('skip link, focus rings and the sidebar', async ({ page }) => {
  await login(page, USERS.nasrin);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();

  const nav = page.locator('nav#sidebar-nav a').first();
  await nav.focus();
  const outline = await nav.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(outline).toBe('3px');
});

test('dialogs trap focus, close on Esc and give focus back', async ({ page }) => {
  await page.goto('/styleguide');
  const opener = page.getByRole('button', { name: 'Open modal' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Edit notice' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog[open]')))).toBe(
    true,
  );
  const duration = await dialog.evaluate(
    (d) => getComputedStyle(d.firstElementChild).animationDuration,
  );
  expect(parseFloat(duration)).toBeLessThan(0.01);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('a confirm with a reason starts in the reason box and needs 3+ characters', async ({
  page,
}) => {
  await page.goto('/styleguide');
  await page.getByRole('button', { name: 'Confirm with reason' }).click();
  const dialog = page.getByRole('dialog');
  const reason = dialog.getByRole('textbox');
  await expect(reason).toBeFocused();
  const save = dialog.getByRole('button', { name: 'Save change' });
  await expect(save).toBeDisabled();
  await reason.fill('Arrived late');
  await expect(save).toBeEnabled();
});

test('tabs move with the arrow keys, skipping disabled ones', async ({ page }) => {
  await page.goto('/styleguide');
  await page.locator('[role=tab][aria-selected=true]').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Published/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Attendance' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('forms: first invalid field focused, server 422 errors on their fields', async ({ page }) => {
  await page.goto('/styleguide');
  await page.locator('form').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('input[name="name"]')).toBeFocused();
  await expect(page.getByText('Enter at least 3 characters')).toBeVisible();
  await page.getByRole('button', { name: 'Simulate server 422' }).click();
  await expect(page.getByText('Already exists')).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Date is outside the active session')).toBeVisible();
});

test('attendance date chips are one radio group with the arrow keys', async ({ page }) => {
  await login(page, USERS.nasrin);
  await page.goto('/teacher/attendance');
  const chips = page.getByRole('group', { name: 'Day' }).getByRole('radio');
  await chips.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(chips.nth(1)).toBeChecked();
});

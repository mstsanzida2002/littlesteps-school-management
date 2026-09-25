// Classes and school years (FR-ADM-03/04). Owns the school year "2098" it creates and deletes;
// it NEVER confirms a switch (admin-mutations does that, after every other spec).
import { expect, test } from '@playwright/test';

import { login, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

test('switching the school year shows what changes and needs the typed name', async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto('/admin/classes?tab=years');
  await page.getByRole('button', { name: 'Add school year' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Name').fill('2098');
  await form.getByLabel('Starts').fill('2098-01-01');
  await form.getByLabel('Ends').fill('2098-12-31');
  await form.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('School year added')).toBeVisible();

  const row = page.getByRole('row', { name: /2098/ });
  await row.getByRole('button', { name: 'Make active' }).click();
  const dialog = page.getByRole('dialog', { name: 'Switch to 2098?' });
  await expect(dialog).toContainText('This changes every screen for everyone');
  await expect(dialog.getByRole('row', { name: /2026 \(now\)/ })).toContainText('40');
  await expect(dialog.getByRole('row', { name: /2098 \(after the switch\)/ })).toContainText('0');

  const confirm = dialog.getByRole('button', { name: 'Switch school year' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox').fill('209');
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox').fill('2098');
  await expect(confirm).toBeEnabled();
  // Not here: other specs are running on 2026.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('row', { name: /2026/ })).toContainText('Active');

  // An unused, inactive year can be deleted.
  await row.getByRole('button', { name: 'Delete 2098' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('School year deleted')).toBeVisible();
});

test('a class in use cannot be deleted; the counts say why', async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto('/admin/classes');
  await page.getByRole('button', { name: 'Delete Playgroup' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(dialog).toContainText('Still in use');
  await expect(dialog).toContainText(/section/);
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(page.getByRole('row', { name: /Playgroup/ })).toBeVisible();
});

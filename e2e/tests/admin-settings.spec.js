// Settings validation (FR-ADM-10). Read-only: nothing is saved here (other specs rely on the
// seeded scale and rules); admin-mutations saves real changes after every other spec.
import { expect, test } from '@playwright/test';

import { login, USERS } from './helpers.js';

test('the grading scale editor checks the rules as you type, and the bar shows the gap', async ({
  page,
}) => {
  await login(page, USERS.admin);
  await page.goto('/admin/settings');
  const save = page.getByRole('button', { name: 'Save grading scale' });
  await expect(save).toBeDisabled(); // nothing changed yet

  // The lowest grade must start at 0%.
  const lastMin = page.getByLabel('Grade 7 starts at (%)');
  await lastMin.fill('10');
  await expect(page.getByText(/lowest grade must start at 0%/)).toBeVisible();
  await expect(page.getByText('No grade', { exact: true })).toBeVisible();
  await expect(save).toBeDisabled();
  await lastMin.fill('0');
  await expect(page.getByText(/lowest grade must start at 0%/)).toHaveCount(0);

  // Two grades can't start at the same percentage, or share a name.
  await page.getByLabel('Grade 2 starts at (%)').fill('80');
  await expect(page.getByText(/already starts at 80%/)).toBeVisible();
  await page.getByLabel('Grade 2 starts at (%)').fill('70');
  await page.getByLabel('Grade 3', { exact: true }).fill('A');
  await expect(page.getByText(/"A" appears more than once/)).toBeVisible();
  await page.getByLabel('Grade 3', { exact: true }).fill('A-');

  // A valid change enables Save (not pressed here).
  await page.getByLabel('Grade 1 starts at (%)').fill('85');
  await expect(save).toBeEnabled();
  await expect(page.getByText(/Published results keep the scale saved with them/)).toBeVisible();

  // At least one school day.
  for (const day of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']) {
    await page.getByLabel(day, { exact: true }).check();
  }
  await expect(page.getByText('At least one day must be a school day')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save attendance rules' })).toBeDisabled();
});

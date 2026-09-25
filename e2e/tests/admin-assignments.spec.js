// Teacher assignments (FR-ADM-06). Owns e2e.clash.teacher; the clashing timetable is never
// saved, so KG-2-B's real timetable is untouched.
import { expect, test } from '@playwright/test';

import { createReadyTeacher, login, USERS } from './helpers.js';

test('a clashing slot shows the server message next to that slot; nothing is saved', async ({
  page,
  request,
}) => {
  await createReadyTeacher(request, {
    username: 'e2e.clash.teacher',
    name: 'Clash Teacher',
    employeeId: 'T-CLASH',
  });
  await login(page, USERS.admin);
  await page.goto('/admin/assignments');
  await page.getByRole('button', { name: 'Assign a teacher' }).click();
  const dialog = page.getByRole('dialog', { name: 'Assign a teacher' });
  await dialog.getByLabel('Teacher').selectOption({ label: 'Clash Teacher' });
  await dialog.getByLabel('Subject').selectOption({ label: 'Math' });
  await dialog.getByRole('combobox', { name: /^Class/ }).selectOption({ label: 'KG-2' });
  await dialog.getByLabel('Section').selectOption({ label: 'B' });

  // Two slots: Sunday early (free) and Monday 10:45, when KG-2-B already has English.
  await dialog.getByRole('button', { name: 'Add a slot' }).click();
  await dialog.getByLabel('Slot 1 day').selectOption('sunday');
  await dialog.getByLabel('Slot 1 starts').fill('07:00');
  await dialog.getByLabel('Slot 1 ends').fill('07:30');
  await dialog.getByRole('button', { name: 'Add a slot' }).click();
  await dialog.getByLabel('Slot 2 day').selectOption('monday');
  await dialog.getByLabel('Slot 2 starts').fill('10:45');
  await dialog.getByLabel('Slot 2 ends').fill('11:15');
  await dialog.getByRole('button', { name: 'Assign' }).click();

  const slotErrors = dialog.getByRole('alert');
  await expect(slotErrors).toHaveCount(1);
  await expect(slotErrors).toContainText('KG-2-B already has');
  // It sits under slot 2 (the Monday one), not slot 1.
  const slot2 = dialog.getByRole('listitem').nth(1);
  await expect(slot2.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('listitem').first().getByRole('alert')).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.getByLabel('Teacher').first().selectOption({ label: 'Clash Teacher' });
  await expect(page.getByText('No assignments yet')).toBeVisible();
});

test('the timetable view shows a class-section week', async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto('/admin/assignments?view=timetable');
  await page.getByLabel('Show the week of').selectOption({ label: 'Playgroup-A' });
  const table = page.getByRole('table', { name: 'Weekly timetable' });
  await expect(table).toContainText('08:00–08:30');
  await expect(table).toContainText('Farhana Akter');
});

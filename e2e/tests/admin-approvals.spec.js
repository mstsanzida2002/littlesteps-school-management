// Approvals (FR-ADM-02/05). Owns the seeded registrations rahim.uddin (approved into KG-2-B
// with roll 21) and sumaiya.rahman (rejected). ishita.paul and tanjim.hasan are left waiting.
import { expect, test } from '@playwright/test';

import { API_URL, login, trackPageErrors, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

test('approve a registration: place the child; the guardian can log in', async ({
  page,
  request,
}) => {
  const errors = trackPageErrors(page);
  await login(page, USERS.admin);
  await page.goto('/admin/registrations');
  const card = page.getByRole('article', { name: 'Registration: Rahim Uddin' });
  await expect(card).toContainText('Salma Begum');
  await expect(card).toContainText('KG-2');
  await card.getByRole('button', { name: 'Approve' }).click();

  const dialog = page.getByRole('dialog', { name: 'Approve Rahim Uddin' });
  // The requested class is chosen, the first section and the suggested roll filled in.
  await expect(dialog.getByLabel('Class')).toHaveValue(/.+/);
  await dialog.getByLabel('Section').selectOption({ label: 'B' });
  await expect(dialog.getByText(/Suggested \d+\. Taken: 1, 2, 3, 4, 5/)).toBeVisible();
  // A roll no other spec uses (student specs create KG-2-B students in parallel).
  await dialog.getByLabel('Roll number').fill('21');
  await dialog.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Rahim Uddin approved and placed')).toBeVisible();
  await expect(card).toHaveCount(0);

  const res = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: 'rahim.uddin', password: 'Student@1234' },
  });
  expect(res.ok()).toBe(true);
  expect(errors).toEqual([]);
});

test('reject a registration: the reason is required and kept', async ({ page, request }) => {
  await login(page, USERS.admin);
  await page.goto('/admin/registrations');
  await page
    .getByRole('article', { name: 'Registration: Sumaiya Rahman' })
    .getByRole('button', { name: 'Reject' })
    .click();
  const dialog = page.getByRole('dialog');
  const reject = dialog.getByRole('button', { name: 'Reject' });
  await expect(reject).toBeDisabled();
  await dialog.getByRole('textbox').fill('The KG-2 classes are full this year');
  await reject.click();
  await expect(page.getByText("Sumaiya Rahman's registration was rejected")).toBeVisible();

  await page.getByRole('tab', { name: 'Rejected' }).click();
  await expect(page.getByRole('article', { name: 'Registration: Sumaiya Rahman' })).toContainText(
    'The KG-2 classes are full this year',
  );
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: 'sumaiya.rahman', password: 'Student@1234' },
  });
  expect(res.status()).toBe(403);
  expect((await res.json()).message).toMatch(/not approved/);
});

// Result entry and publishing (FR-TCH-08…12). Owns KG-1-A and tahmina.rahman.
import { expect, test } from '@playwright/test';

import { apiAs, login, studentLogin, trackPageErrors, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

let draftId;

test.beforeAll(async ({ request }) => {
  const teacher = await apiAs(request, USERS.tahmina);
  const drafts = (await teacher.get('/assessments?status=draft&limit=50')).body.data;
  draftId = drafts.find((a) => a.classId.name === 'KG-1' && a.sectionId.name === 'A')._id;
});

test('enter marks, save the draft and publish (missing students highlighted first)', async ({
  page,
  request,
}) => {
  const errors = trackPageErrors(page);
  await login(page, USERS.tahmina);
  await page.goto('/teacher/results?status=draft');
  await expect(page.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('aria-selected', 'true');
  await page.goto(`/teacher/results/${draftId}`);
  await expect(page.getByRole('heading', { name: 'Class Test 2' })).toBeVisible();

  // Publishing a half-entered draft: the server lists the missing students; they are highlighted.
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish results' }).click();
  await expect(page.getByText(/still need an entry/).first()).toBeVisible();
  await expect(page.getByText('no entry').first()).toBeVisible();

  // Fill the empty marks; the grade preview follows the scale.
  const marks = page.locator('input[data-col="marks"]');
  const count = await marks.count();
  for (let i = 0; i < count; i += 1) {
    if ((await marks.nth(i).inputValue()) === '') await marks.nth(i).fill('23');
  }
  await expect(page.getByText('92%').first()).toBeVisible();

  // Keyboard: Enter moves to the same column in the next row.
  await marks.first().focus();
  await page.keyboard.press('Enter');
  await expect(marks.nth(1)).toBeFocused();

  // One student was away: no marks for them.
  const lastRow = page.getByRole('row').last();
  await lastRow.getByText('Absent', { exact: true }).click();
  await expect(lastRow.locator('input[data-col="marks"]')).toBeDisabled();

  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('All changes saved')).toBeVisible();

  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish results' }).click();
  await expect(page.getByText('Guardians can see these results.')).toBeVisible();

  const guardian = await apiAs(request, studentLogin('kg1-a-01'));
  const published = (await guardian.get('/notifications?type=result_published&limit=50')).body.data;
  expect(published.filter((n) => n.data?.assessmentId === draftId)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('a published result changes only with a reason', async ({ page }) => {
  await login(page, USERS.tahmina);
  await page.goto(`/teacher/results/${draftId}`);
  const firstRow = page.getByRole('row').nth(1);
  await firstRow.getByRole('button', { name: /^Change .*'s result$/ }).click();
  const dialog = page.getByRole('dialog');
  const marksInput = dialog.getByLabel(/Marks \(out of 25\)/);
  // The seed's marks are randomised (deterministically, but the exact value still shifts with
  // the real date some steps earlier consume — see server/src/seed/seedDatabase.js), so pick a
  // value guaranteed to differ from whatever is currently there, rather than assuming it's not
  // already 24.
  const next = (await marksInput.inputValue()) === '24' ? '23' : '24';
  await marksInput.fill(next);
  await dialog.getByRole('button', { name: 'Save change' }).click();
  await expect(dialog.getByText('Give a reason (at least 3 characters)')).toBeVisible();
  await dialog.getByLabel('Reason for the change').fill('Marking mistake on question 3');
  await dialog.getByRole('button', { name: 'Save change' }).click();
  await expect(dialog).toBeHidden();
  await expect(firstRow).toContainText(`${next} / 25`);
});

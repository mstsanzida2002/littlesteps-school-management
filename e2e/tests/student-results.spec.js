// Guardian results (FR-STU-05). Owns the KG-1-B draft Math test (Class Test 2) and kg1-b-01,
// Faiza Noor. The admin completes and publishes the draft through the API.
import { expect, test } from '@playwright/test';

import { apiAs, login, studentLogin, trackPageErrors, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const CHILD = { username: 'kg1-b-01', firstName: 'Faiza' };
const REMARKS = 'Counts to twenty with confidence.';
let draftId;

test.beforeAll(async ({ request }) => {
  const admin = await apiAs(request, USERS.admin);
  const { data } = (await admin.get('/assessments?status=draft&limit=100')).body;
  draftId = data.find(
    (a) => a.classId.name === 'KG-1' && a.sectionId.name === 'B' && a.subjectId.name === 'Math',
  )._id;
});

test('a draft test never appears, not even by its address', async ({ page }) => {
  await login(page, studentLogin(CHILD.username));
  await page.goto('/student/results');
  await expect(page.getByRole('heading', { name: 'English' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Math' })).toHaveCount(0);
  await expect(page.getByText('Class Test 2')).toHaveCount(0);

  await page.goto(`/student/results/${draftId}`);
  await expect(page.getByRole('heading', { name: "We couldn't find that page" })).toBeVisible();
});

test('once published it appears live, with the grade, marks and remarks', async ({
  page,
  request,
}) => {
  const errors = trackPageErrors(page);
  await login(page, studentLogin(CHILD.username));
  await page.goto('/student/results?view=test');
  await expect(page.getByRole('tab', { name: 'By test' })).toHaveAttribute('aria-selected', 'true');

  // The teacher's side: complete every entry, then publish (FR-TCH-10/11).
  const admin = await apiAs(request, USERS.admin);
  const { students } = (await admin.get(`/assessments/${draftId}`)).body.data;
  const me = (await apiAs(request, studentLogin(CHILD.username))).me;
  const entries = students.map((s) =>
    s.studentId === me._id
      ? { studentId: s.studentId, attendance: 'present', marksObtained: 22, remarks: REMARKS }
      : { studentId: s.studentId, attendance: 'present', marksObtained: 15 },
  );
  expect((await admin.put(`/results/${draftId}`, { entries })).status).toBe(200);
  expect((await admin.patch(`/assessments/${draftId}/publish`)).status).toBe(200);

  // The result_published notification refreshes the page: no reload needed.
  const card = page.getByRole('link', { name: /Class Test 2/ });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText('A+');
  await expect(card).toContainText('22 out of 25');
  await expect(card).toContainText(REMARKS);

  // The test page, and what the grades mean (from the scale saved at publishing).
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/student/results/${draftId}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Class Test 2' })).toBeVisible();
  await page.getByRole('button', { name: 'What do the grades mean?' }).click();
  const sheet = page.getByRole('dialog', { name: 'What the grades mean' });
  await expect(sheet.locator('tr[aria-current="true"]')).toContainText('A+');
  await expect(sheet).toContainText('80% and above');
  // Only this child's own result: no averages, ranks or other children.
  await expect(page.locator('#main')).not.toContainText(/average|rank|class mean/i);
  expect(errors).toEqual([]);
});

// Admin user management (FR-ADM-01/02). Owns the accounts it creates: a KG-2-B student
// (e2e.kg2child), e2e.history.teacher (has an assignment) and e2e.suspended.teacher.
import { expect, test } from '@playwright/test';

import { apiAs, createReadyTeacher, login, trackPageErrors, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const CHILD = { name: 'Nadia Karim', nickname: 'Nadu', username: 'e2e.kg2child' };
let childPassword;

test('create a student in four steps; the slip has the details; the guardian must change the password', async ({
  page,
  browser,
}) => {
  const errors = trackPageErrors(page);
  await login(page, USERS.admin);
  await page.goto('/admin/users');
  await page.getByRole('link', { name: 'New student' }).click();

  // Step 1: the child.
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('At least 2 characters')).toBeVisible();
  await page.getByLabel('Full name').fill(CHILD.name);
  await page.getByLabel('Nickname').fill(CHILD.nickname);
  await page.getByLabel('Date of birth').fill('2021-04-09');
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 2: placement, with the suggested roll and the taken numbers.
  await page.getByRole('combobox', { name: /^Class/ }).selectOption({ label: 'KG-2' });
  await page.getByRole('combobox', { name: /^Section/ }).selectOption({ label: 'B' });
  await expect(page.getByText(/Suggested: \d+ · Taken: 1, 2, 3, 4, 5/)).toBeVisible();
  const roll = await page.getByLabel('Roll number').inputValue();
  expect(Number(roll)).toBeGreaterThanOrEqual(6);
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3: guardian.
  await page.getByLabel("Guardian's name").fill('Rokeya Karim');
  await page.getByLabel('Relation').selectOption('mother');
  await page.getByLabel('Mobile').fill('01711000555');
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 4: login. The suggested username follows the school pattern; we use our own.
  await expect(page.getByLabel('Username')).toHaveValue(`kg2-b-${roll.padStart(2, '0')}`);
  await page.getByLabel('Username').fill(CHILD.username);
  await page.getByRole('button', { name: 'Generate' }).click();
  childPassword = await page.getByLabel('Temporary password').inputValue();
  expect(childPassword).toMatch(/^[A-Z][a-z]{3}-\d{4}-[a-z]{4}$/);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText(`${CHILD.name}'s account is ready`)).toBeVisible();
  await expect(page.getByText(childPassword)).toBeVisible();

  // The login slip: the right child, class, username and password, in English and Bangla.
  await page.getByRole('button', { name: 'Print login slip' }).click();
  const slip = page.getByRole('dialog').getByRole('article', { name: 'Login slip' });
  await expect(slip).toContainText(CHILD.name);
  await expect(slip).toContainText('KG-2-B');
  await expect(slip).toContainText(CHILD.username);
  await expect(slip).toContainText(childPassword);
  await expect(slip.locator('[lang="bn"]').first()).toContainText('লিটলস্টেপসে');
  // Printing shows only the slip copy (index.css: body.printing-slip). Headless print() returns
  // at once (and fires afterprint), so record the call and look at the print layout ourselves.
  await page.evaluate(() => {
    window.__printed = 0;
    window.print = () => {
      window.__printed += 1;
    };
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Print login slip' }).click();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  const printed = page.locator('.print-slip');
  await expect(printed).toBeVisible();
  await expect(printed).toContainText(childPassword);
  await expect(page.locator('#root')).toBeHidden();
  const bangla = await printed
    .locator('section[lang="bn"]')
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(bangla).toContain('Hind Siliguri');
  expect(await page.evaluate(() => document.fonts.check('16px "Hind Siliguri"', 'অ'))).toBe(true);
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();

  // The guardian logs in with the temporary password and must choose a new one.
  const guardian = await (await browser.newContext()).newPage();
  await guardian.goto('/login');
  await guardian.locator('#identifier').fill(CHILD.username);
  await guardian.locator('#password').fill(childPassword);
  await guardian.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(guardian).toHaveURL(/\/change-password$/);
  await guardian.locator('#currentPassword').fill(childPassword);
  await guardian.locator('#newPassword').fill('NaduHome2026');
  await guardian.locator('#confirmPassword').fill('NaduHome2026');
  await guardian.getByRole('button', { name: 'Save new password' }).click();
  await expect(guardian.getByRole('heading', { level: 1, name: 'Nadu at a glance' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('delete refused for an account with history → "Suspend instead"', async ({
  page,
  request,
}) => {
  const { user } = await createReadyTeacher(request, {
    username: 'e2e.history.teacher',
    name: 'History Teacher',
    employeeId: 'T-HIST',
  });
  // An assignment is history: the account can no longer be deleted.
  const admin = await apiAs(request, USERS.admin);
  const classes = (await admin.get('/classes?limit=50')).body.data;
  const kg2 = classes.find((c) => c.name === 'KG-2');
  const sections = (await admin.get(`/sections?classId=${kg2._id}`)).body.data;
  const subjects = (await admin.get('/subjects?limit=50')).body.data;
  const assigned = await admin.post('/teacher-assignments', {
    teacherId: user._id,
    classId: kg2._id,
    sectionId: sections.find((s) => s.name === 'B')._id,
    subjectId: subjects.find((s) => s.name === 'Drawing')._id,
  });
  expect(assigned.status).toBe(201);

  await login(page, USERS.admin);
  await page.goto(`/admin/users/${user._id}`);
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  const offer = page.getByRole('dialog', { name: 'This account has history' });
  await expect(offer).toContainText('assignment');
  const suspend = offer.getByRole('button', { name: 'Suspend instead' });
  await expect(suspend).toBeDisabled();
  await offer.getByLabel('Reason for suspending').fill('Left the school');
  await suspend.click();
  await expect(page.getByText('History Teacher is suspended and signed out')).toBeVisible();
  await expect(page.getByText('Suspended', { exact: true }).first()).toBeVisible();
});

test('suspending a signed-in teacher signs them out at once, and says why', async ({
  page,
  browser,
  request,
}) => {
  const { user, login: teacherLogin } = await createReadyTeacher(request, {
    username: 'e2e.suspended.teacher',
    name: 'Suspended Teacher',
    employeeId: 'T-SUSP',
  });
  const teacher = await (await browser.newContext()).newPage();
  await login(teacher, teacherLogin);
  await expect(teacher).toHaveURL(/\/teacher$/);

  await login(page, USERS.admin);
  await page.goto(`/admin/users/${user._id}`);
  await page.getByRole('button', { name: 'Suspend' }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Contract ended');
  await page.getByRole('dialog').getByRole('button', { name: 'Suspend' }).click();
  await expect(page.getByText('Suspended Teacher is suspended and signed out')).toBeVisible();

  // No reload: the teacher's page leaves on its own, with the reason.
  await expect(teacher).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(teacher.getByText('Your account was suspended')).toBeVisible();
});

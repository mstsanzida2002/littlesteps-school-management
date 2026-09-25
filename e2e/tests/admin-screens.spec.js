// Screenshots of every admin screen and state at 375 and 1280 px (npm run e2e:screens), saved to
// docs/design/screens/admin/. Changes only what it creates: a KG-2-B student per width
// (e2e.screens.<width>) and an unused school year (2099); dialogs are opened, not confirmed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { addDays, apiAs, login, markableDay, USERS } from './helpers.js';

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../docs/design/screens/admin',
);
const WIDTHS = [375, 1280];
let ids;

test.beforeAll(async ({ request }) => {
  const admin = await apiAs(request, USERS.admin);
  const settings = (await admin.get('/settings/school')).body.data;
  const users = (await admin.get('/users?limit=100')).body.data;
  const farhana = users.find((u) => u.username === 'farhana.akter');
  const ayaan = users.find((u) => u.username === 'pg-a-01');
  const classes = (await admin.get('/classes?limit=50')).body.data;
  const pg = classes.find((c) => c.name === 'Playgroup');
  const pgA = (await admin.get(`/sections?classId=${pg._id}`)).body.data.find(
    (s) => s.name === 'A',
  );
  const published = (
    await admin.get(`/assessments?status=published&classId=${pg._id}&sectionId=${pgA._id}`)
  ).body.data[0];
  const meetings = (await admin.get('/meetings?when=upcoming&limit=20')).body.data;
  const sessions = (await admin.get('/sessions?limit=20')).body.data;
  if (!sessions.some((s) => s.name === '2099')) {
    await admin.post('/sessions', { name: '2099', startDate: '2099-01-01', endDate: '2099-12-31' });
  }
  let day = markableDay(settings);
  day = addDays(day, -1);
  while ([5, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())) day = addDays(day, -1);
  ids = {
    farhana: farhana._id,
    ayaan: ayaan._id,
    published: published._id,
    meeting: meetings.find((m) => m.title.startsWith('Parent-teacher'))._id,
    attendance: `classId=${pg._id}&sectionId=${pgA._id}&date=${day}`,
  };
});

const hideDevtools = (page) =>
  page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' });

async function shot(page, name, width, { full = width > 800 } = {}) {
  await hideDevtools(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: full });
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({
      viewport: { width, height: width < 800 ? 812 : 900 },
      deviceScaleFactor: width < 800 ? 2 : 1,
      isMobile: width < 800,
      hasTouch: width < 800,
      reducedMotion: 'reduce',
    });

    test('dashboard: normal, loading, error, menu', async ({ page }) => {
      await login(page, USERS.admin);
      await expect(page.getByText('Attendance, last 30 days')).toBeVisible();
      await shot(page, 'dashboard', width, { full: true });

      await page.route('**/api/dashboard/admin', async (route) => {
        await new Promise((r) => setTimeout(r, 4000));
        await route.continue();
      });
      await page.reload();
      await expect(page.getByLabel('Loading dashboard')).toBeVisible();
      await shot(page, 'dashboard-loading', width, { full: false });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await page.route('**/api/dashboard/admin', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Service temporarily unavailable',
            code: 'DATABASE_UNAVAILABLE',
          }),
        }),
      );
      await page.reload();
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
      await shot(page, 'dashboard-error', width, { full: false });
      await page.unrouteAll({ behavior: 'ignoreErrors' });

      if (width < 800) {
        await page.reload();
        await page.getByRole('button', { name: /^Account:/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await shot(page, 'menu', width, { full: false });
      }
    });

    test('users: list, filters, account, reset, delete refused', async ({ page }) => {
      await login(page, USERS.admin);
      await page.goto('/admin/users');
      await expect(page.getByRole('link', { name: /Ayaan Rahman/ })).toBeVisible();
      await shot(page, 'users', width, { full: true });
      await page.goto('/admin/users?role=teacher');
      await expect(page.getByRole('link', { name: /Farhana Akter/ })).toBeVisible();
      await shot(page, 'users-teachers', width, { full: false });

      await page.goto(`/admin/users/${ids.ayaan}`);
      await expect(page.getByText('Child and class')).toBeVisible();
      await shot(page, 'user-student', width, { full: true });
      await page.getByRole('button', { name: 'Reset password' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'user-reset-password', width, { full: false });
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

      await page.goto(`/admin/users/${ids.farhana}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Farhana Akter' })).toBeVisible();
      await shot(page, 'user-teacher', width, { full: true });
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('dialog', { name: 'This account has history' })).toBeVisible();
      await shot(page, 'user-delete-refused', width, { full: false });

      await page.goto(`/admin/users/${ids.ayaan}/edit`);
      await expect(page.getByRole('heading', { level: 1, name: /Edit Ayaan/ })).toBeVisible();
      await shot(page, 'user-edit', width, { full: true });
    });

    test('new student: four steps, created, login slip (screen and print)', async ({ page }) => {
      await login(page, USERS.admin);
      await page.goto('/admin/users/new?role=student');
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByText('At least 2 characters')).toBeVisible();
      await shot(page, 'new-student-errors', width, { full: false });
      await page.getByLabel('Full name').fill('Tahmid Chowdhury');
      await page.getByLabel('Nickname').fill('Tomu');
      await page.getByLabel('Date of birth').fill('2021-02-17');
      await shot(page, 'new-student-1', width, { full: true });
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByRole('combobox', { name: /^Class/ }).selectOption({ label: 'KG-2' });
      await page.getByRole('combobox', { name: /^Section/ }).selectOption({ label: 'B' });
      await expect(page.getByText(/Suggested: \d+/)).toBeVisible();
      await shot(page, 'new-student-2', width, { full: true });
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByLabel("Guardian's name").fill('Shahana Chowdhury');
      await page.getByLabel('Relation').selectOption('mother');
      await page.getByLabel('Mobile').fill('01711000777');
      await shot(page, 'new-student-3', width, { full: true });
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByLabel('Username').fill(`e2e.screens.${width}`);
      await shot(page, 'new-student-4', width, { full: true });
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page.getByText(/account is ready/)).toBeVisible();
      await shot(page, 'new-student-created', width, { full: false });

      await page.getByRole('button', { name: 'Print login slip' }).click();
      await expect(page.getByRole('dialog', { name: 'Login slip' })).toBeVisible();
      await page.evaluate(() => document.fonts.load('16px "Hind Siliguri"', 'অআ'));
      await shot(page, 'login-slip', width, { full: false });
      // The print view (only the slip, A4 on paper).
      await page.evaluate(() => {
        window.print = () => {};
        document.body.classList.add('printing-slip');
      });
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.print-slip')).toBeVisible();
      await shot(page, 'login-slip-print', width, { full: true });
      await page.emulateMedia({ media: 'screen' });
    });

    test('new teacher form', async ({ page }) => {
      await login(page, USERS.admin);
      await page.goto('/admin/users/new?role=teacher');
      await expect(page.getByLabel('Employee ID')).toBeVisible();
      await shot(page, 'new-teacher', width, { full: true });
    });

    test('approvals: queue, approve, reject', async ({ page }) => {
      await login(page, USERS.admin);
      await page.goto('/admin/registrations');
      await expect(page.getByRole('article').first()).toBeVisible();
      await shot(page, 'approvals', width, { full: true });
      await page.getByRole('article').first().getByRole('button', { name: 'Approve' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByText(/Suggested \d+/)).toBeVisible();
      await shot(page, 'approve-dialog', width, { full: false });
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('article').first().getByRole('button', { name: 'Reject' }).click();
      await page.getByRole('dialog').getByRole('textbox').fill('The class is full');
      await shot(page, 'reject-dialog', width, { full: false });
    });

    test('classes and years: tabs, switch confirmation, blocked delete', async ({ page }) => {
      await login(page, USERS.admin);
      for (const tab of ['classes', 'sections', 'subjects', 'years']) {
        await page.goto(`/admin/classes?tab=${tab}`);
        await expect(page.getByRole('table').or(page.getByRole('list')).first()).toBeVisible();
        await shot(page, `structure-${tab}`, width, { full: true });
      }
      await page
        .getByRole('row', { name: /2099/ })
        .or(page.getByRole('listitem').filter({ hasText: '2099' }))
        .getByRole('button', { name: 'Make active' })
        .click();
      const dialog = page.getByRole('dialog', { name: 'Switch to 2099?' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('textbox').fill('2099');
      await shot(page, 'switch-year', width, { full: false });
      await dialog.getByRole('button', { name: 'Cancel' }).click();

      await page.goto('/admin/classes');
      await page.getByRole('button', { name: 'Delete Playgroup' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('dialog')).toContainText('Still in use');
      await shot(page, 'delete-blocked', width, { full: false });
    });

    test('assignments: by teacher, by class, timetable, timetable editor', async ({ page }) => {
      await login(page, USERS.admin);
      await page.goto('/admin/assignments');
      await expect(page.getByRole('heading', { name: 'Farhana Akter' })).toBeVisible();
      await shot(page, 'assignments', width, { full: false });
      await page.goto('/admin/assignments?view=class');
      await shot(page, 'assignments-by-class', width, { full: false });
      await page.goto('/admin/assignments?view=timetable');
      await page.getByLabel('Show the week of').selectOption({ label: 'Playgroup-A' });
      await shot(page, 'timetable', width, { full: true });
      await page.goto('/admin/assignments');
      await page.getByRole('button', { name: 'Timetable' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'timetable-editor', width, { full: false });
    });

    test('settings: rules and a scale with a gap', async ({ page }) => {
      await login(page, USERS.admin);
      await page.goto('/admin/settings');
      await expect(page.getByText('Grading scale').first()).toBeVisible();
      await shot(page, 'settings', width, { full: true });
      await page.getByLabel('Grade 7 starts at (%)').fill('10');
      await page.getByLabel('Grade 2 starts at (%)').fill('80');
      await shot(page, 'settings-invalid', width, { full: true });
    });

    test('attendance override, results, meetings', async ({ page }) => {
      await login(page, USERS.admin);
      await page.goto(`/admin/attendance?${ids.attendance}`);
      await expect(page.getByRole('button', { name: 'Whole day' }).first()).toBeVisible();
      await shot(page, 'attendance-override', width, { full: false });
      await page.getByRole('button', { name: 'Whole day' }).first().click();
      await expect(page.getByRole('dialog')).toContainText('Admin override');
      await shot(page, 'attendance-override-dialog', width, { full: false });
      await page.keyboard.press('Escape');

      await page.goto('/admin/results');
      await expect(page.getByRole('link', { name: 'Class Test 1' }).first()).toBeVisible();
      await shot(page, 'results', width, { full: false });
      await page.goto(`/admin/results/${ids.published}`);
      await expect(page.getByText('Published').first()).toBeVisible();
      await shot(page, 'result', width, { full: false });

      await page.goto('/admin/meetings');
      await shot(page, 'meetings', width, { full: false });
      await page.goto(`/admin/meetings/${ids.meeting}`);
      await expect(page.getByRole('button', { name: 'Cancel meeting' })).toBeVisible();
      await shot(page, 'meeting', width, { full: true });
      await page.goto('/admin/meetings/new');
      await page.getByLabel('Staff only').check();
      await shot(page, 'meeting-new', width, { full: true });
    });

    test('notices and the audit log', async ({ page }) => {
      await login(page, USERS.admin);
      await page.goto('/admin/notices');
      await expect(page.getByRole('article').first()).toBeVisible();
      await shot(page, 'notices', width, { full: true });
      await page.goto('/admin/notices/new');
      await page.getByLabel('Title').fill('Picnic on Thursday');
      await page
        .getByRole('textbox', { name: /^Notice/ })
        .fill('Bring a hat and water. বাচ্চাদের টুপি ও পানি সঙ্গে দিন।');
      await page.getByLabel('Pin to the top').check();
      await shot(page, 'notice-new', width, { full: true });

      await page.goto('/admin/audit-log');
      await expect(page.getByRole('button', { name: 'Before / after' }).first()).toBeVisible();
      await shot(page, 'audit-log', width, { full: false });
      await page.getByRole('button', { name: 'Before / after' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'audit-entry', width, { full: false });
    });
  });
}

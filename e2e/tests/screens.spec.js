// Screenshots of every teacher screen at 375 and 1280 px (npm run e2e:screens), saved to
// docs/design/screens/teacher/. Read-only: dialogs are opened but never confirmed, and the
// publish attempt is one the server rejects.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { apiAs, login, USERS } from './helpers.js';

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../docs/design/screens/teacher',
);
const WIDTHS = [375, 1280];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const addDays = (key, n) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const isOff = (key, off) => off.includes(WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()]);

let ids;

test.beforeAll(async ({ request }) => {
  const teacher = await apiAs(request, USERS.farhana);
  const settings = (await teacher.get('/settings/school')).body.data;
  let day = settings.today;
  while (isOff(day, settings.weeklyOffDays)) day = addDays(day, -1);
  let pastDay = addDays(day, -1);
  while (isOff(pastDay, settings.weeklyOffDays)) pastDay = addDays(pastDay, -1);
  const pgA = (await teacher.get('/teacher-assignments/mine')).body.data.classSections[0];
  const assessments = (await teacher.get('/assessments?limit=50')).body.data.filter(
    (a) => a.sectionId._id === pgA.sectionId,
  );
  const sheet = (
    await teacher.get(
      `/attendance/class-sections/${pgA.classId}/${pgA.sectionId}/sheet?date=${pastDay}`,
    )
  ).body.data;
  const meeting = (await teacher.get('/meetings?limit=5')).body.data.find(
    (m) => m.organizerId._id === teacher.me._id,
  );
  ids = {
    cs: `classId=${pgA.classId}&sectionId=${pgA.sectionId}`,
    day,
    pastDay,
    draft: assessments.find((a) => a.status === 'draft')._id,
    published: assessments.find((a) => a.status === 'published' && a.mode === 'marks')._id,
    student: sheet.students[3].studentId,
    meeting: meeting._id,
  };
});

/** Hide the dev-only TanStack devtools button. */
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
      // Charts draw instantly (Recharts follows prefers-reduced-motion), so nothing is mid-animation.
      reducedMotion: 'reduce',
    });

    test('dashboard, including loading and error states', async ({ page }) => {
      await login(page, USERS.farhana);
      await expect(page.getByText("Today's classes")).toBeVisible();
      await shot(page, 'dashboard', width);

      await page.route('**/api/dashboard/teacher', async (route) => {
        await new Promise((r) => setTimeout(r, 4000));
        await route.continue();
      });
      await page.reload();
      await expect(page.getByLabel('Loading dashboard')).toBeVisible();
      await shot(page, 'dashboard-loading', width, { full: false });

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await page.route('**/api/dashboard/teacher', (route) =>
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
    });

    test('take attendance: roster, confirm, already taken', async ({ page }) => {
      await login(page, USERS.farhana);
      await page.goto(`/teacher/attendance?${ids.cs}&date=${ids.day}`);
      await page.getByRole('radiogroup').nth(2).getByText('Absent').click();
      await page.getByRole('radiogroup').nth(4).getByText('Late').click();
      await shot(page, 'take-attendance', width, { full: false });
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'take-attendance-confirm', width, { full: false });
      await page.getByRole('dialog').getByRole('button', { name: 'Keep editing' }).click();

      page.once('dialog', (d) => d.accept());
      await page.getByRole('radiogroup').nth(2).getByText('Present').click();
      await page.getByRole('radiogroup').nth(4).getByText('Present').click();
      await page.goto(`/teacher/attendance?${ids.cs}&date=${ids.pastDay}`);
      await expect(page.getByText('Already taken — view or edit')).toBeVisible();
      await shot(page, 'take-attendance-already-taken', width, { full: false });
    });

    test('records, edit dialog, summary, student history', async ({ page }) => {
      await login(page, USERS.farhana);
      await page.goto(`/teacher/attendance/records?${ids.cs}&date=${ids.pastDay}`);
      await expect(page.getByRole('button', { name: /^Change English/ }).first()).toBeVisible();
      await shot(page, 'attendance-records', width, { full: false });
      await page
        .getByRole('button', { name: /^Change English/ })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'attendance-edit-dialog', width, { full: false });
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

      await page.goto(`/teacher/attendance/summary?${ids.cs}`);
      await expect(page.getByText('Daily attendance rate')).toBeVisible();
      await shot(page, 'attendance-summary', width);

      await page.goto(`/teacher/students/${ids.student}/attendance`);
      await expect(page.getByText('Recent days')).toBeVisible();
      await shot(page, 'student-attendance', width);
    });

    test('results: list, new, draft entry, publish problems, published, edit', async ({ page }) => {
      await login(page, USERS.farhana);
      await page.goto('/teacher/results');
      await expect(page.getByRole('link', { name: 'Class Test 1' }).first()).toBeVisible();
      await shot(page, 'assessments', width);

      await page.goto('/teacher/results/new');
      await expect(page.getByLabel('Total marks')).toBeVisible();
      await shot(page, 'assessment-new', width);

      await page.goto(`/teacher/results/${ids.draft}`);
      await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
      await shot(page, 'result-entry', width, { full: false });
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Publish results' }).click();
      await expect(page.getByText(/still need an entry/).first()).toBeVisible();
      await shot(page, 'result-entry-missing', width, { full: false });

      await page.goto(`/teacher/results/${ids.published}`);
      await expect(page.getByText('Guardians can see these results.')).toBeVisible();
      await shot(page, 'results-published', width);
      await page
        .getByRole('button', { name: /^Change .*'s result$/ })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'result-edit-dialog', width, { full: false });
    });

    test('meetings, notices, notifications', async ({ page }) => {
      await login(page, USERS.farhana);
      await page.goto('/teacher/meetings');
      await expect(page.getByRole('link', { name: /settling-in/ })).toBeVisible();
      await shot(page, 'meetings', width);
      await page.goto('/teacher/meetings?when=past');
      await expect(page.getByText('No past meetings')).toBeVisible();
      await shot(page, 'meetings-empty', width, { full: false });

      await page.goto('/teacher/meetings/new');
      await expect(page.getByLabel('Title')).toBeVisible();
      await shot(page, 'meeting-new', width);

      await page.goto(`/teacher/meetings/${ids.meeting}`);
      await expect(page.getByRole('list', { name: 'Replies', exact: true })).toBeVisible();
      await shot(page, 'meeting-detail', width);

      await page.goto('/teacher/notices');
      await expect(page.getByText('Winter vacation schedule')).toBeVisible();
      await shot(page, 'notices', width);

      await page.goto('/teacher/notifications');
      await expect(page.getByRole('button', { name: /Notice:/ }).first()).toBeVisible();
      await shot(page, 'notifications', width);
    });
  });
}

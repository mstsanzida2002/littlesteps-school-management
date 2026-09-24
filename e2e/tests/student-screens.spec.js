// Screenshots of every guardian screen and state at 375 and 1280 px (npm run e2e:screens), saved
// to docs/design/screens/student/. Read-only, except one newly admitted Nursery-B student it
// creates for the "nothing recorded yet" states (e2e.newchild).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { apiAs, login, studentLogin, USERS } from './helpers.js';

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../docs/design/screens/student',
);
const WIDTHS = [375, 1280];
const NEW_CHILD = { identifier: 'e2e.newchild', password: 'Newchild@1234' };

let ids;

test.beforeAll(async ({ request }) => {
  const admin = await apiAs(request, USERS.admin);
  const raisa = await apiAs(request, studentLogin('pg-a-04'));
  const ayaan = await apiAs(request, studentLogin('pg-a-01'));

  // A day Raisa was absent (for the day sheet) and one of Ayaan's published tests.
  const history = (await raisa.get(`/attendance/student/${raisa.me._id}/history`)).body.data;
  const absentDay = history.find((r) => r.status === 'absent').date;
  const results = (await ayaan.get(`/results/student/${ayaan.me._id}`)).body.data;
  const marksTest = results.find(
    (r) => r.assessment.mode === 'marks' && r.attendance === 'present',
  );
  const meetings = (await ayaan.get('/meetings?when=upcoming')).body.data;

  // A child admitted today: nothing recorded yet.
  const exists = await request.post('http://localhost:5100/api/auth/login', { data: NEW_CHILD });
  if (!exists.ok()) {
    const classes = (await admin.get('/classes?limit=50')).body.data;
    const nursery = classes.find((c) => c.name === 'Nursery');
    const sections = (await admin.get(`/sections?classId=${nursery._id}&limit=50`)).body.data;
    const created = await admin.post('/users', {
      role: 'student',
      name: 'Nabil Rahman',
      username: NEW_CHILD.identifier,
      password: 'Temporary@1234',
      profile: {
        classId: nursery._id,
        sectionId: sections.find((s) => s.name === 'B')._id,
        dateOfBirth: '2022-05-14',
        nickname: 'Nabil',
        guardian: { name: 'Rehana Rahman', relation: 'mother', phone: '01711000999' },
      },
    });
    expect(created.status).toBe(201);
    const first = await apiAs(request, {
      identifier: NEW_CHILD.identifier,
      password: 'Temporary@1234',
    });
    const changed = await first.patch('/auth/password', {
      currentPassword: 'Temporary@1234',
      newPassword: NEW_CHILD.password,
    });
    expect(changed.status).toBe(200);
  }

  ids = {
    absentDay,
    test: marksTest.assessment._id,
    meeting: meetings.find((m) => m.title.startsWith('Parent-teacher'))._id,
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

const ring = (page) => page.getByRole('img', { name: /^Attendance \d/ });

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({
      viewport: { width, height: width < 800 ? 812 : 900 },
      deviceScaleFactor: width < 800 ? 2 : 1,
      isMobile: width < 800,
      hasTouch: width < 800,
      reducedMotion: 'reduce',
    });

    test('home: normal, below 75%, nothing yet, loading, error', async ({ page, browser }) => {
      await login(page, studentLogin('pg-a-01'));
      await expect(ring(page)).toBeVisible();
      await shot(page, 'dashboard', width, { full: true });

      await page.route('**/api/dashboard/student', async (route) => {
        await new Promise((r) => setTimeout(r, 4000));
        await route.continue();
      });
      await page.reload();
      await expect(page.getByLabel('Loading the home page')).toBeVisible();
      await shot(page, 'dashboard-loading', width, { full: false });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await page.route('**/api/dashboard/student', (route) =>
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

      const low = await (await browser.newContext()).newPage();
      await low.setViewportSize({ width, height: width < 800 ? 812 : 900 });
      await login(low, studentLogin('pg-a-04'));
      await expect(low.getByText(/attendance is below 75%/)).toBeVisible();
      await shot(low, 'dashboard-below-threshold', width, { full: true });

      const fresh = await (await browser.newContext()).newPage();
      await fresh.setViewportSize({ width, height: width < 800 ? 812 : 900 });
      await login(fresh, NEW_CHILD);
      await expect(
        fresh.getByText(/No classes have been recorded for Nabil yet/).first(),
      ).toBeVisible();
      await shot(fresh, 'dashboard-nothing-yet', width, { full: true });
      await fresh.goto('/student/results');
      await expect(fresh.getByText('No results yet')).toBeVisible();
      await shot(fresh, 'results-empty', width, { full: false });
    });

    test('attendance: calendar, warning, a day, the legend', async ({ page }) => {
      await login(page, studentLogin('pg-a-04'));
      await page.goto('/student/attendance');
      await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible();
      await shot(page, 'attendance', width, { full: true });

      await page.goto(
        `/student/attendance?month=${ids.absentDay.slice(0, 7)}&day=${ids.absentDay}`,
      );
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'attendance-day', width, { full: false });
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();

      await page.getByText('What the colours and icons mean').click();
      await page.getByText('What the colours and icons mean').scrollIntoViewIfNeeded();
      await shot(page, 'attendance-legend', width, { full: false });
    });

    test('results: by subject, by test, one test, what the grades mean', async ({ page }) => {
      await login(page, studentLogin('pg-a-01'));
      await page.goto('/student/results');
      await expect(page.getByRole('tab', { name: 'By subject' })).toBeVisible();
      await shot(page, 'results', width, { full: true });
      await page.getByRole('tab', { name: 'By test' }).click();
      await shot(page, 'results-by-test', width, { full: true });

      await page.goto(`/student/results/${ids.test}`);
      await expect(page.getByRole('button', { name: 'What do the grades mean?' })).toBeVisible();
      await shot(page, 'result', width, { full: false });
      await page.getByRole('button', { name: 'What do the grades mean?' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'result-grades', width, { full: false });
    });

    test('meetings: upcoming, past, details with the reply form, cancelled', async ({
      page,
      browser,
    }) => {
      await login(page, studentLogin('pg-a-01'));
      await page.goto('/student/meetings');
      await expect(page.getByRole('group', { name: /^Reply to/ }).first()).toBeVisible();
      await shot(page, 'meetings', width, { full: true });
      await page.getByRole('tab', { name: 'Past' }).click();
      await expect(page.getByText('No past meetings')).toBeVisible();
      await shot(page, 'meetings-past', width, { full: false });

      await page.goto(`/student/meetings/${ids.meeting}`);
      await expect(page.getByRole('button', { name: 'Add to calendar' })).toBeVisible();
      await shot(page, 'meeting', width, { full: true });

      const kg2 = await (await browser.newContext()).newPage();
      await kg2.setViewportSize({ width, height: width < 800 ? 812 : 900 });
      await login(kg2, studentLogin('kg2-b-03'));
      await kg2.goto('/student/meetings');
      await kg2.getByRole('link', { name: /KG-2 orientation/ }).click();
      await expect(kg2.getByText('This meeting was cancelled', { exact: true })).toBeVisible();
      await shot(kg2, 'meeting-cancelled', width, { full: false });
    });

    test('notices, notifications, profile, menu, switch child, not found', async ({ page }) => {
      await login(page, studentLogin('pg-a-02'));
      await page.goto('/student/notices');
      await expect(page.getByRole('heading', { level: 1, name: 'Notices' })).toBeVisible();
      await shot(page, 'notices', width, { full: true });
      await page.goto('/student/notifications');
      await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
      await shot(page, 'notifications', width, { full: true });
      await page.goto('/student/profile');
      await expect(page.getByText('Guardian on file')).toBeVisible();
      await shot(page, 'profile', width, { full: true });
      await page.goto('/student/meetings/000000000000000000000000');
      await expect(page.getByRole('heading', { name: "We couldn't find that page" })).toBeVisible();
      await shot(page, 'not-found', width, { full: false });

      if (width < 800) {
        await page.getByRole('button', { name: /^Account:/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await shot(page, 'menu', width, { full: false });
        await page.getByRole('dialog').getByRole('button', { name: 'Switch child' }).click();
      } else {
        await page.getByRole('button', { name: 'Switch child' }).click();
      }
      await expect(page.getByRole('region', { name: 'Choose a child' })).toBeVisible();
      await shot(page, 'switch-child', width, { full: false });
    });
  });
}

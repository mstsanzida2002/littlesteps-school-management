// Live updates over Socket.io: the bell and the notification list change without a reload.
// Owns KG-2-B (a student's attendance is overridden and restored by the admin).
import { expect, test } from '@playwright/test';

import { apiAs, login, studentLogin, USERS } from './helpers.js';

const STUDENT = 'kg2-b-02';

test('an admin correction reaches the guardian live', async ({ page, request }) => {
  const guardian = await apiAs(request, studentLogin(STUDENT));
  const admin = await apiAs(request, USERS.admin);
  const history = (await admin.get(`/attendance/student/${guardian.me._id}/history`)).body.data;
  const byDate = Map.groupBy(history, (r) => r.date);
  const day = [...byDate.keys()].find((d) => byDate.get(d).every((r) => r.status === 'present'));

  await login(page, studentLogin(STUDENT));
  await page.goto('/student/notifications');
  const bell = page.getByTestId('unread-count');
  await expect(page.locator('#main h1')).toHaveText('Notifications');
  const before = Number((await bell.count()) ? await bell.textContent() : 0);
  const items = page.getByRole('button', { name: /Absent on/ });
  await expect(items).toHaveCount(0);

  const override = await admin.patch(`/attendance/students/${guardian.me._id}/days/${day}`, {
    status: 'absent',
    reason: 'E2E: live update check',
  });
  expect(override.status).toBe(200);

  // No reload: the socket pushes the count and the list refreshes itself. (The absence can also
  // trigger a low-attendance warning, so the count grows by at least one.)
  await expect.poll(async () => Number(await bell.textContent())).toBeGreaterThan(before);
  await expect(items).toHaveCount(1);
});

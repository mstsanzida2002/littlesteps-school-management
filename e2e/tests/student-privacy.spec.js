// Changing an address never shows another child's information (read-only). Uses kg2-b-05.
import { expect, test } from '@playwright/test';

import { apiAs, login, studentLogin, USERS } from './helpers.js';

const CHILD = 'kg2-b-05';
let other;

test.beforeAll(async ({ request }) => {
  const admin = await apiAs(request, USERS.admin);
  const meetings = (await admin.get('/meetings?limit=100')).body.data;
  const drafts = (await admin.get('/assessments?status=draft&limit=100')).body.data;
  const someoneElse = await apiAs(request, studentLogin('pg-a-01'));
  other = {
    // Invites Playgroup-A only.
    meeting: meetings.find((m) => m.title === 'Playgroup-A guardians: settling-in chat')._id,
    // This child's own class, but a draft.
    draft: drafts.find((a) => a.classId.name === 'KG-2' && a.sectionId.name === 'B')._id,
    student: someoneElse.me._id,
    name: someoneElse.me.name,
  };
});

test('other children’s meetings, drafts and unknown pages all show "not found"', async ({
  page,
}) => {
  await login(page, studentLogin(CHILD));
  const notFound = page.getByRole('heading', { name: "We couldn't find that page" });
  for (const path of [
    `/student/meetings/${other.meeting}`,
    `/student/results/${other.draft}`,
    '/student/results/not-an-id',
    '/student/meetings/000000000000000000000000',
    '/student/somewhere-else',
  ]) {
    await page.goto(path);
    await expect(notFound, path).toBeVisible();
    await expect(page.locator('#main')).not.toContainText('Playgroup-A guardians');
    // Still inside the app: the header shows whose account this is, with a way home.
    await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible();
  }

  // Staff pages send a guardian back to their own home.
  await page.goto(`/teacher/students/${other.student}/attendance`);
  await expect(page).toHaveURL(/\/student$/);
});

test('the API answers 404 (not 403) for another child, so nothing is confirmed', async ({
  request,
}) => {
  const guardian = await apiAs(request, studentLogin(CHILD));
  for (const path of [
    `/attendance/student/${other.student}/summary`,
    `/attendance/student/${other.student}/history`,
    `/results/student/${other.student}`,
    `/meetings/${other.meeting}`,
  ]) {
    const res = await guardian.get(path);
    expect(res.status, path).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(other.name);
  }
});

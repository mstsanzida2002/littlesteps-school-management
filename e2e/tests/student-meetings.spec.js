// Guardian meetings (FR-STU-06/07). Owns meetings the admin creates for nur-b-03 only
// (Prapti Saha, called "Tuli"), so no other guardian gets their notifications.
import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { addDays, apiAs, login, studentLogin, trackPageErrors, USERS } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const CHILD = { username: 'nur-b-03', nickname: 'Tuli' };
const TITLE = 'Tuli: speech practice check-in';
const CANCELLED = 'Tuli: art fair helpers';
let meetingId;
let when;

test.beforeAll(async ({ request }) => {
  const admin = await apiAs(request, USERS.admin);
  const guardian = await apiAs(request, studentLogin(CHILD.username));
  const { today } = (await admin.get('/settings/school')).body.data;
  when = { date: addDays(today, 3), time: '16:30' };
  const create = async (title, extra = {}) => {
    const res = await admin.post('/meetings', {
      title,
      type: 'parent_teacher',
      ...when,
      durationMinutes: 45,
      venue: 'Nursery-B classroom',
      agenda: 'How Tuli is getting on with speaking in class.',
      invite: { target: 'students', studentIds: [guardian.me._id] },
      ...extra,
    });
    expect(res.status).toBe(201);
    return res.body.data._id;
  };
  meetingId = await create(TITLE);
  await create(CANCELLED);
});

test('reply from the list, then change the reply with a note on the details page', async ({
  page,
  request,
}) => {
  const errors = trackPageErrors(page);
  await login(page, studentLogin(CHILD.username));
  await page.goto('/student/meetings');
  const card = page.getByRole('listitem').filter({ hasText: TITLE });
  await expect(card).toContainText('No reply yet');

  const quick = card.getByRole('group', { name: `Reply to ${TITLE}` });
  await quick.getByRole('button', { name: 'Will attend' }).click();
  await expect(quick.getByRole('button', { name: 'Will attend' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(card.getByText('Will attend').first()).toBeVisible();

  // Details: when, where, agenda, organiser, and the reply form.
  await card.getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByText('Nursery-B classroom')).toBeVisible();
  await expect(page.getByText('4:30 pm')).toBeVisible();
  await expect(page.getByText('How Tuli is getting on')).toBeVisible();
  await page.getByText('Cannot attend', { exact: true }).click();
  await page.getByLabel('Note for the school (optional)').fill('We are away that week, sorry.');
  await page.getByRole('button', { name: 'Save reply' }).click();
  await expect(page.getByText('Reply saved').first()).toBeVisible();

  const admin = await apiAs(request, USERS.admin);
  const { students } = (await admin.get(`/meetings/${meetingId}/responses`)).body.data;
  const mine = students.find((s) => s.response);
  expect(mine).toMatchObject({ response: 'cannot_attend', note: 'We are away that week, sorry.' });
  expect(errors).toEqual([]);
});

test('"Add to calendar" downloads the meeting at 4:30 pm Dhaka time (10:30 UTC)', async ({
  page,
}) => {
  await login(page, studentLogin(CHILD.username));
  await page.goto(`/student/meetings/${meetingId}`);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add to calendar' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('tuli-speech-practice-check-in.ics');
  const ics = await readFile(await file.path(), 'utf8');
  const utc = when.date.replaceAll('-', '');
  expect(ics).toContain(`DTSTART:${utc}T103000Z\r\n`);
  expect(ics).toContain(`DTEND:${utc}T111500Z\r\n`);
  expect(ics).toContain(`SUMMARY:${TITLE}`);
  expect(ics).toContain('LOCATION:Nursery-B classroom');
});

test('a cancelled meeting says so, with the reason, and takes no replies', async ({
  page,
  request,
}) => {
  await login(page, studentLogin(CHILD.username));
  await page.goto('/student/meetings');
  await page.getByRole('link', { name: new RegExp(CANCELLED) }).click();
  await expect(page.getByRole('button', { name: 'Save reply' })).toBeVisible();

  // The school cancels it while the page is open: the page updates by itself.
  const admin = await apiAs(request, USERS.admin);
  const list = (await admin.get('/meetings?when=upcoming&limit=100')).body.data;
  const cancelledId = list.find((m) => m.title === CANCELLED)._id;
  expect(
    (await admin.post(`/meetings/${cancelledId}/cancel`, { reason: 'Moved to spring' })).status,
  ).toBe(200);

  await expect(page.getByText('This meeting was cancelled', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Reason: Moved to spring')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save reply' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add to calendar' })).toHaveCount(0);

  // In the list: marked Cancelled, without reply buttons.
  await page.getByRole('link', { name: 'All meetings' }).click();
  const card = page.getByRole('listitem').filter({ hasText: CANCELLED });
  await expect(card).toContainText('Cancelled');
  await expect(card.getByRole('button', { name: 'Will attend' })).toHaveCount(0);

  // And the API refuses a reply anyway (409 MEETING_CANCELLED).
  const guardian = await apiAs(request, studentLogin(CHILD.username));
  const res = await guardian.patch(`/meetings/${cancelledId}/respond`, { response: 'will_attend' });
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('MEETING_CANCELLED');
});

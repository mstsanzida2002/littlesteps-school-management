import { expect } from '@playwright/test';

/** The API behind the E2E client (in-memory database, see playwright.config.js). */
export const API_URL = 'http://localhost:5100/api';

/**
 * Seeded accounts (server/src/seed/seedData.js). Each spec that changes data owns its own
 * teacher / class-section / students, so spec files can run in parallel.
 */
export const USERS = {
  admin: { identifier: 'admin', password: 'Admin@1234', name: 'Mohammad Kamal Hossain' },
  // Playgroup (A + B): attendance.spec
  farhana: { identifier: 'farhana.akter', password: 'Teacher@1234', name: 'Farhana Akter' },
  // Nursery: a11y.spec (read-only), student-attendance.spec (marks Nursery-A)
  nasrin: { identifier: 'nasrin.sultana', password: 'Teacher@1234', name: 'Nasrin Sultana' },
  // KG-1: results.spec
  tahmina: { identifier: 'tahmina.rahman', password: 'Teacher@1234', name: 'Tahmina Rahman' },
  // KG-2: meetings.spec (section A only)
  shirin: { identifier: 'shirin.akhter', password: 'Teacher@1234', name: 'Shirin Akhter' },
};
export const studentLogin = (username) => ({ identifier: username, password: 'Student@1234' });

// --- School dates (as the app computes them: Dhaka calendar days as 'YYYY-MM-DD') ----------

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const addDays = (key, n) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const isOff = (key, offDays) =>
  offDays.includes(WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()]);

/** The e2e seed's unmarked day: the newest school day on or before today (GET /settings/school). */
export function markableDay(settings) {
  let day = settings.today;
  while (isOff(day, settings.weeklyOffDays)) day = addDays(day, -1);
  return day;
}

/** "Thu, 24 Sep", the way the app labels a day. */
export function dayLabel(key) {
  const date = new Date(`${key}T00:00:00Z`);
  const part = (options) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(date);
  return `${part({ weekday: 'short' })}, ${part({ day: 'numeric' })} ${part({ month: 'short' })}`;
}

/** Sign in through the login form; waits for the signed-in page. */
export async function login(page, user, { expectPath } = {}) {
  await page.goto('/login');
  await page.locator('#identifier').fill(user.identifier);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.locator('#main h1')).toBeVisible();
  if (expectPath) await expect(page).toHaveURL(expectPath);
}

/** Minimal API client for set-up and assertions (not for what the test is about). */
export async function apiAs(request, user) {
  const res = await request.post(`${API_URL}/auth/login`, { data: user });
  expect(res.ok(), `login ${user.identifier}`).toBeTruthy();
  const { accessToken, user: me } = (await res.json()).data;
  const call = async (method, path, data) => {
    const response = await request.fetch(`${API_URL}${path}`, {
      method,
      data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { status: response.status(), body: await response.json() };
  };
  return {
    me,
    get: (path) => call('GET', path),
    post: (path, data) => call('POST', path, data ?? {}),
    patch: (path, data) => call('PATCH', path, data ?? {}),
    put: (path, data) => call('PUT', path, data ?? {}),
    delete: (path) => call('DELETE', path),
  };
}

/** Fail the test on uncaught page errors (console 401s from session checks are expected). */
export function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

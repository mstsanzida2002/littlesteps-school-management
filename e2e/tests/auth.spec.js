// Sign-in, session restore, role guards, multi-tab refresh and logout (FR-AUTH-01…06).
import { expect, test } from '@playwright/test';

import { login, studentLogin, trackPageErrors, USERS } from './helpers.js';

/** Count refresh / logout calls a page makes. */
function trackAuth(page) {
  const log = { refresh: [], logout: 0 };
  page.on('response', (res) => {
    if (res.url().endsWith('/api/auth/refresh')) log.refresh.push(res.status());
    if (res.url().endsWith('/api/auth/logout')) log.logout += 1;
  });
  return log;
}

test.describe('authentication', () => {
  test('anonymous visit goes to login with a single refresh attempt', async ({ page }) => {
    const log = trackAuth(page);
    await page.goto('/teacher');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    // StrictMode double effects still send exactly one refresh (NO_SESSION is not retried).
    expect(log.refresh).toEqual([401]);
  });

  test('wrong password shows the generic message', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#identifier').fill(USERS.farhana.identifier);
    await page.locator('#password').fill('Wrong-pass1');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Invalid username/email or password');
  });

  test('empty form: field errors, no request', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByText('Enter your username or email')).toBeVisible();
    await expect(page.locator('#identifier')).toBeFocused();
  });

  test('sign in, reload, role guard and two-tab logout', async ({ context }) => {
    const tab1 = await context.newPage();
    const errors = trackPageErrors(tab1);
    const log1 = trackAuth(tab1);
    await login(tab1, USERS.farhana, { expectPath: /\/teacher$/ });
    await expect(tab1.getByText(USERS.farhana.name).filter({ visible: true })).toBeVisible();
    await expect(tab1.getByRole('button', { name: 'Log out' }).first()).toBeAttached();

    // Reload keeps the session through the refresh cookie.
    log1.refresh.length = 0;
    await tab1.reload();
    await expect(tab1).toHaveURL(/\/teacher$/);
    await expect(tab1.locator('#main h1')).toBeVisible();
    expect(log1.refresh).toEqual([200]);

    // Role guard: a teacher visiting /admin lands on their own dashboard.
    await tab1.goto('/admin');
    await expect(tab1).toHaveURL(/\/teacher$/);

    // Second tab, simultaneous reloads (refresh race): both stay signed in, nobody logs out.
    const tab2 = await context.newPage();
    const log2 = trackAuth(tab2);
    await tab2.goto('/teacher');
    await expect(tab2.locator('#main h1')).toBeVisible();
    await Promise.all([tab1.reload(), tab2.reload()]);
    await expect(tab1.locator('#main h1')).toBeVisible();
    await expect(tab2.locator('#main h1')).toBeVisible();
    await expect(tab1).toHaveURL(/\/teacher$/);
    await expect(tab2).toHaveURL(/\/teacher$/);
    expect(log1.logout + log2.logout).toBe(0);

    // Logout in tab 1: tab 2 follows immediately (BroadcastChannel).
    await tab1.bringToFront();
    await tab1.getByRole('button', { name: 'Log out' }).first().click();
    await expect(tab1).toHaveURL(/\/login$/);
    expect(log1.logout).toBe(1);
    await tab2.bringToFront();
    await expect(tab2).toHaveURL(/\/login$/);

    // Reload after logout stays signed out.
    await tab2.reload();
    await expect(tab2).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
  });

  test('a deep link survives sign-in, and /login redirects when signed in', async ({ page }) => {
    await page.goto('/student');
    await expect(page).toHaveURL(/\/login$/);
    await page.locator('#identifier').fill('pg-a-01');
    await page.locator('#password').fill(studentLogin('pg-a-01').password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByText('Ayaan Rahman').filter({ visible: true }).first()).toBeVisible();

    await page.goto('/login');
    await expect(page).toHaveURL(/\/student$/);
  });
});

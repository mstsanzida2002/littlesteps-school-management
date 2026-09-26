// The guardian's home page on a slow 3G connection (production build, see
// playwright.perf.config.js). Read-only: its own API instance and database.
import { expect, test } from '@playwright/test';

// Chrome DevTools' classic "Slow 3G" preset: 2 s round trip, 400 kbit/s each way.
const SLOW_3G = {
  offline: false,
  latency: 2000,
  downloadThroughput: 50_000,
  uploadThroughput: 50_000,
};

// Budgets (ms from navigation start) with headroom over measured runs (HTTP/2). See CLAUDE.md,
// "Slow networks", for the measured numbers these head room over.
// At 2 s per round trip, a repeat visit is near the floor: the page, the session check and
// the dashboard request are one round trip each.
// shellVisible/firstPaint are latency-bound (one round trip for the HTML response) and have
// little natural variance, so a regression that reintroduces a render-blocking resource before
// first paint (what these two exist to catch) shows up clearly even with modest headroom.
// skeleton/content are bound by how long the JS bundle takes to download (cold) or by the
// auth-refresh round trip before the app can render anything (warm) — unrelated to first paint —
// so they keep the same generous headroom as before this file added shellVisible.
const BUDGET = {
  cold: { shellVisible: 4_000, firstPaint: 4_000, skeleton: 14_000, content: 16_500 },
  warm: { shellVisible: 6_000, firstPaint: 3_000, skeleton: 6_000, content: 8_500 },
};

const GUARDIAN = { identifier: 'pg-a-04', password: 'Student@1234' };

/**
 * Elapsed ms until *something* is visible besides a blank page: the static boot shell
 * (index.html's inline `<style>`, no CSS/JS fetch needed), or — on a warm/cached visit, where
 * every asset can be served from the disk cache fast enough that React mounts the real app
 * before the static shell would even be noticed — the app's own loading state. Either is a
 * pass: the point is no unstyled blank screen, not that the static shell specifically wins.
 */
async function waitForShellOrApp(page, start) {
  while (Date.now() - start < 30_000) {
    const [shellCount, appVisible] = await Promise.all([
      page.locator('.boot-card').count(),
      page
        .getByLabel('Loading the home page')
        .isVisible()
        .catch(() => false),
    ]);
    if (shellCount > 0 || appVisible) return Date.now() - start;
    await page.waitForTimeout(20);
  }
  throw new Error('Neither the boot shell nor the app became visible within 30s');
}

/**
 * Visit /student under the throttle; times to the static shell (or, if the app beats it there —
 * see waitForShellOrApp), first paint, the React skeleton and the content.
 *
 * "shellVisible" is measured directly (the DOM), rather than only trusting the browser's native
 * first-contentful-paint timestamp, so a regression that makes FCP fire on *something other than
 * the shell* (a render-blocking resource delaying the shell but not simple enough to keep FCP
 * from firing on some other early paint) is caught by comparing the two on the cold run below,
 * instead of being hidden by them drifting together.
 */
async function measure(page, cdp, { cold }) {
  if (cold) await cdp.send('Network.clearBrowserCache');
  const requests = [];
  const onRequest = (request) => requests.push(new URL(request.url()).pathname);
  page.on('request', onRequest);
  // What actually came over the network (not from the browser cache), and how many bytes.
  const responses = new Map();
  const onResponse = ({ requestId, response }) =>
    responses.set(requestId, {
      path: new URL(response.url).pathname,
      protocol: response.protocol,
      bytes: 0,
    });
  // Bytes over the wire per request: 0 when the browser cache answered.
  const onFinished = ({ requestId, encodedDataLength }) => {
    const entry = responses.get(requestId);
    if (entry) entry.bytes = encodedDataLength;
  };
  cdp.on('Network.responseReceived', onResponse);
  cdp.on('Network.loadingFinished', onFinished);

  const start = Date.now();
  await page.goto('/student', { waitUntil: 'commit' });
  const shellVisible = await waitForShellOrApp(page, start);
  await expect(page.getByLabel('Loading the home page')).toBeVisible();
  const skeleton = Date.now() - start;
  await expect(page.getByRole('img', { name: /^Attendance \d/ })).toBeVisible();
  const content = Date.now() - start;
  const firstPaint = await page.evaluate(
    () => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
  );
  page.off('request', onRequest);
  cdp.off('Network.responseReceived', onResponse);
  cdp.off('Network.loadingFinished', onFinished);
  const all = [...responses.values()];
  return {
    shellVisible,
    firstPaint: Math.round(firstPaint),
    skeleton,
    content,
    requests,
    downloadedJs: all.filter((r) => r.bytes > 0 && r.path.endsWith('.js')).map((r) => r.path),
    kb: Math.round(all.reduce((sum, r) => sum + r.bytes, 0) / 1024),
    protocol: all.find((r) => r.path.endsWith('.js'))?.protocol,
  };
}

const count = (requests, path) => requests.filter((p) => p === path).length;

test('home page on slow 3G: skeleton first, one data request, no chart library', async ({
  page,
}) => {
  // Sign in at full speed (the test is about coming back to the app).
  await page.goto('/login');
  await page.locator('#identifier').fill(GUARDIAN.identifier);
  await page.locator('#password').fill(GUARDIAN.password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('img', { name: /^Attendance \d/ })).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_3G);

  const cold = await measure(page, cdp, { cold: true });
  const warm = await measure(page, cdp, { cold: false });

  const report = `slow 3G (${cold.protocol})  shell / first paint / skeleton / content (ms), over the wire
  cold (empty cache): ${cold.shellVisible} / ${cold.firstPaint} / ${cold.skeleton} / ${cold.content}, ${cold.kb} KB
  warm (repeat visit): ${warm.shellVisible} / ${warm.firstPaint} / ${warm.skeleton} / ${warm.content}, ${warm.kb} KB`;
  console.log(report);
  test.info().annotations.push({ type: 'timings', description: report });

  for (const run of [cold, warm]) {
    const api = run.requests.filter((p) => p.startsWith('/api/'));
    // One session check, one dashboard request, the bell's count; nothing else.
    expect(count(api, '/api/auth/refresh')).toBe(1);
    expect(count(api, '/api/dashboard/student')).toBe(1);
    expect(count(api, '/api/notifications/unread-count')).toBeLessThanOrEqual(1);
    expect(
      api.filter(
        (p) => !/^\/api\/(auth\/refresh|dashboard\/student|notifications\/unread-count)$/.test(p),
      ),
    ).toEqual([]);
    // The guardian's home page never downloads the chart library.
    expect(
      run.requests.filter((p) => /TrendLineChart|ComparisonBarChart|recharts/i.test(p)),
    ).toEqual([]);
  }
  // A repeat visit downloads no JavaScript again (immutable, hashed assets).
  expect(cold.downloadedJs.length).toBeGreaterThan(0);
  expect(warm.downloadedJs).toEqual([]);

  for (const [name, run] of Object.entries({ cold, warm })) {
    expect(run.shellVisible, `${name} shell visible`).toBeLessThan(BUDGET[name].shellVisible);
    expect(run.firstPaint, `${name} first paint`).toBeLessThan(BUDGET[name].firstPaint);
    expect(run.skeleton, `${name} skeleton`).toBeLessThan(BUDGET[name].skeleton);
    expect(run.content, `${name} content`).toBeLessThan(BUDGET[name].content);
  }
  // On a cold visit, "shellVisible" is the static shell (nothing is cached yet for the app to
  // beat it with), so it should land right on FCP — if it's meaningfully behind, a
  // render-blocking resource is delaying the shell specifically, not just both numbers moving
  // together. (On a warm visit the app can legitimately win that race — see waitForShellOrApp —
  // so this check doesn't apply there.)
  expect(cold.shellVisible - cold.firstPaint, 'cold shell vs FCP gap').toBeLessThan(1500);
});

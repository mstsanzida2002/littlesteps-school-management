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

// Budgets (ms from navigation start) with ~30% headroom over measured runs (HTTP/2):
//   cold 5.0 / 10.8 / 12.7 s, warm 2.1 / 4.6 / 6.5 s (first paint / skeleton / content).
// At 2 s per round trip, a repeat visit is near the floor: the page, the session check and
// the dashboard request are one round trip each. See CLAUDE.md, "Guardian screens".
const BUDGET = {
  cold: { firstPaint: 7_000, skeleton: 14_000, content: 16_500 },
  warm: { firstPaint: 3_000, skeleton: 6_000, content: 8_500 },
};

const GUARDIAN = { identifier: 'pg-a-04', password: 'Student@1234' };

/** Visit /student under the throttle; times to first paint, the skeleton and the content. */
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

  const report = `slow 3G (${cold.protocol})  first paint / skeleton / content (ms), over the wire
  cold (empty cache): ${cold.firstPaint} / ${cold.skeleton} / ${cold.content}, ${cold.kb} KB
  warm (repeat visit): ${warm.firstPaint} / ${warm.skeleton} / ${warm.content}, ${warm.kb} KB`;
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
    expect(run.firstPaint, `${name} first paint`).toBeLessThan(BUDGET[name].firstPaint);
    expect(run.skeleton, `${name} skeleton`).toBeLessThan(BUDGET[name].skeleton);
    expect(run.content, `${name} content`).toBeLessThan(BUDGET[name].content);
  }
});

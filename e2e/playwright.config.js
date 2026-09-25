import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite (npm run e2e). Starts its own stack, so it never touches littlesteps_dev:
 *   - API on :5100 against an in-memory MongoDB replica set, seeded with the --e2e demo data
 *     (server/src/scripts/e2eServer.js);
 *   - the Vite dev client on :5174, proxying /api and /socket.io to it.
 *
 * Parallel safety: spec files run in parallel, tests inside a file in order. Specs that change
 * data each own their class-section or student (see CLAUDE.md, "E2E suite").
 */
const API_PORT = 5100;
const CLIENT_PORT = 5174;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: './test-results',
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: [/screens\.spec\.js/, /admin-mutations\.spec\.js/],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      // Real saves of school-wide settings (grading scale, off days, the active school year):
      // only after every other e2e spec has finished, one at a time.
      name: 'admin-mutations',
      testMatch: /admin-mutations\.spec\.js/,
      dependencies: ['e2e'],
      workers: 1,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'screens',
      testMatch: /screens\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run e2e:api -w server',
      cwd: '..',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        CLIENT_ORIGIN: `http://localhost:${CLIENT_PORT}`,
        BCRYPT_ROUNDS: '4',
        EMAIL_ENABLED: 'false',
        // Many logins and page loads from one IP in a few minutes.
        RATE_LIMIT_MAX: '100000',
        RATE_LIMIT_REFRESH_SESSION_MAX: '10000',
        RATE_LIMIT_REFRESH_IP_MAX: '100000',
      },
    },
    {
      command: `npm run dev -w client -- --port ${CLIENT_PORT} --strictPort`,
      cwd: '..',
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_DEV_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});

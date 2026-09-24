import { execFileSync } from 'node:child_process';

import { defineConfig, devices } from '@playwright/test';

/**
 * Slow-network check of the guardian's home page (npm run e2e:perf). Runs against a production
 * build served like Vercel serves it (perf/prodServer.js: compressed, immutable assets), with
 * its own in-memory API, so it can run next to the main suite.
 */
const API_PORT = 5110;
const CLIENT_PORT = 5176;
// perf/prodServer.js speaks HTTP/2 over TLS (like Vercel) when openssl can make a certificate.
const hasOpenssl = (() => {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const CLIENT_URL = `${hasOpenssl ? 'https' : 'http'}://localhost:${CLIENT_PORT}`;

export default defineConfig({
  testDir: './perf',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  outputDir: './test-results/perf',
  use: {
    ...devices['Pixel 7'],
    baseURL: CLIENT_URL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run e2e:api -w server',
      cwd: '..',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        CLIENT_ORIGIN: CLIENT_URL,
        BCRYPT_ROUNDS: '4',
        EMAIL_ENABLED: 'false',
      },
    },
    {
      command: 'npm run build -w client && node e2e/perf/prodServer.js',
      cwd: '..',
      url: CLIENT_URL,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { PORT: String(CLIENT_PORT), API_PORT: String(API_PORT) },
    },
  ],
});

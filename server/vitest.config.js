import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: { NODE_ENV: 'test' },
    // Integration tests that start mongodb-memory-server can be slow on first run
    // (binary download), so give hooks room.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});

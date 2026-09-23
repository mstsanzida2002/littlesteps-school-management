import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Tests never read server/.env (see config/env.js); everything they need is set here.
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-only-access-secret-at-least-32-characters-long',
      BCRYPT_ROUNDS: '4',
    },
    // Integration tests that start mongodb-memory-server can be slow on first run
    // (binary download), so give hooks room.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});

import { defineConfig } from 'vitest/config';

// Unit tests for pure client logic (status map, server-error mapping, dates, summaries).
// Node environment: no DOM needed; components are checked in the browser (see /styleguide).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});

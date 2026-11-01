import { defineConfig } from 'vitest/config';

/** `npm run bench:pitch`: the pitch detector benchmark, kept out of `npm test`. */
export default defineConfig({
  test: {
    include: ['src/**/*.benchmark.ts'],
    environment: 'node',
    testTimeout: 600_000,
    // The tables are the output, so always show console logs.
    reporters: ['default'],
    silent: false,
  },
});

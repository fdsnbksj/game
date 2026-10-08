import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Pure game logic. No emulator, so it runs anywhere in a few seconds. Some tests play
        // hundreds of whole games, which the deploy machine runs several times slower than a
        // laptop, so they get a minute rather than the default five seconds.
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node', testTimeout: 60_000 },
      },
      {
        // Firestore rules, against the emulator started by `npm run test:rules`.
        test: {
          name: 'rules',
          include: ['tests/rules/**/*.test.ts'],
          environment: 'node',
          // Test files share one emulator and clear it between tests.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
    ],
  },
});

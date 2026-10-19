import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'engine', include: ['packages/spreadsheet-engine/src/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'shared', include: ['packages/shared/src/**/*.test.ts'], environment: 'node' } },
      {
        test: {
          name: 'api',
          include: ['apps/api/src/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
      'apps/web/vitest.config.ts',
    ],
  },
});

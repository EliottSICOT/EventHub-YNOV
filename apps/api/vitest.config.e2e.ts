import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-database.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
  },
});

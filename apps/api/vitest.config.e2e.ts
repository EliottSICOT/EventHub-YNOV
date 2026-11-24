import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-database.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // SMTP_HOST vide : aucun e-mail ne part pendant les tests.
    env: { DATABASE_URL: TEST_DATABASE_URL, SMTP_HOST: '' },
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
  },
});

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-database.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // SMTP_HOST vide : aucun e-mail ne part pendant les tests.
    // Les images envoyées vont dans un dossier temporaire, jamais dans apps/api/uploads.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SMTP_HOST: '',
      UPLOADS_DIR: join(tmpdir(), 'eventhub-e2e-uploads'),
    },
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
  },
});

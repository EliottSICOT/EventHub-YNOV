import { execSync } from 'node:child_process';
import { assertTestDatabase, TEST_DATABASE_URL } from './test-database.js';

/** Applique les migrations sur la base de test (créée si besoin) avant la suite e2e. */
export default function setup() {
  assertTestDatabase(TEST_DATABASE_URL);
  execSync('prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

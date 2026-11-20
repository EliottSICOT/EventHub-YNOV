export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://eventhub:eventhub@localhost:5432/eventhub_test?schema=public';

/** Les tests e2e vident les tables : on refuse toute base qui n'est pas explicitement une base de test. */
export function assertTestDatabase(url: string) {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(
      `Base « ${name} » refusée : les tests e2e exigent une base dont le nom finit par _test.`,
    );
  }
}

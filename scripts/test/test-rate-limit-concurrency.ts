import assert from 'node:assert/strict';
import { getDb } from '../../src/lib/db/client';
import { rateLimit } from '../../src/lib/rate-limit';

async function main() {
  const key = `concurrency:${crypto.randomUUID()}`;
  const max = 5;

  const results = await Promise.all(
    Array.from({ length: 20 }, () => rateLimit(key, { max, windowSeconds: 60 }))
  );

  const accepted = results.filter((result) => result.success).length;
  const stored = await getDb().query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM rate_limit_attempts WHERE key = $1',
    [key]
  );

  assert.equal(accepted, max, 'parallel requests exceeded the configured limit');
  assert.equal(Number(stored.rows[0]?.count), max, 'database stored too many attempts');

  await getDb().end();
  console.log(`Rate limit concurrency verified: ${accepted}/${results.length} accepted`);
}

main().catch(async (error) => {
  console.error(error);
  await getDb().end().catch(() => undefined);
  process.exitCode = 1;
});

/**
 * Checks that the rate limiter never admits more attempts than its limit when many requests
 * for one key arrive at once. Postgres proved this with advisory locks across pool connections;
 * D1 and the local SQLite client instead run each batch atomically, one at a time, and the
 * limiter's batch only inserts while the count still fits. This fires 20 overlapping calls at
 * a limit of 5 and checks exactly 5 were accepted and stored, then that a multi-unit
 * reservation that doesn't fit records nothing.
 *
 * Uses a throwaway SQLite file unless SQLITE_PATH is set (or D1_REMOTE=true, where it checks
 * the real D1; it only writes a few rate_limit_attempts rows under a random key and removes them).
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const throwawayDir = !process.env.SQLITE_PATH && process.env.D1_REMOTE !== 'true'
  ? mkdtempSync(join(tmpdir(), 'sealsend-rl-'))
  : null;
if (throwawayDir) process.env.SQLITE_PATH = join(throwawayDir, 'sealsend.db');

async function main() {
  // Imported after SQLITE_PATH is settled: the client opens the database on first use.
  const { exec, getDb, query } = await import('../../src/lib/db/client');
  const { consumeQuota, rateLimit } = await import('../../src/lib/rate-limit');
  if (throwawayDir) await exec(readFileSync('src/lib/db/schema.sql', 'utf8'));

  const key = `concurrency:${crypto.randomUUID()}`;
  const max = 5;
  const count = async () =>
    (await query<{ count: number }>('SELECT COUNT(*) AS count FROM rate_limit_attempts WHERE key = $1', [key]))[0]?.count;

  try {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => rateLimit(key, { max, windowSeconds: 60 }))
    );
    const accepted = results.filter((result) => result.success).length;
    assert.equal(accepted, max, 'parallel requests exceeded the configured limit');
    assert.equal(await count(), max, 'database stored too many attempts');

    // All or nothing: a reservation that no longer fits must not record a partial batch.
    const overflow = await consumeQuota(key, 2, { max: max + 1, windowSeconds: 60 });
    assert.equal(overflow.success, false, 'a reservation over the limit was accepted');
    assert.equal(await count(), max, 'a rejected reservation recorded attempts');

    console.log(`Rate limit concurrency verified: ${accepted}/${results.length} accepted`);
  } finally {
    await query('DELETE FROM rate_limit_attempts WHERE key = $1', [key]).catch(() => undefined);
    if (throwawayDir) {
      getDb().close();
      rmSync(throwawayDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

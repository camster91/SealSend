/** Local synthetic fixtures only. No provider configuration or production data. */
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from 'bcryptjs';
import { openSqliteDb } from '../../src/lib/db/sqlite-local';
import type { Statement } from '../../src/lib/db/sqlite-dialect';

/** The throwaway QA database. `query` keeps the `{ rows }` shape the browser checks use. */
export type QaDb = {
  path: string;
  query: <T = Record<string, unknown>>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }>;
  batch: (statements: Statement[]) => Promise<unknown[][]>;
  exec: (sql: string) => Promise<void>;
  close: () => Promise<void>;
};

/**
 * Creates a throwaway SQLite file with the app schema and the synthetic social QA fixtures,
 * and points SQLITE_PATH at it so the app (in this process or a child started with
 * process.env) uses the same file. `server.stop()` closes it and deletes the directory.
 */
export async function startSocialQa() {
  if (process.env.D1_REMOTE === 'true') {
    throw new Error('Refusing to run local QA with D1_REMOTE=true: the fixtures only go into a throwaway SQLite file.');
  }
  const dir = await mkdtemp(join(tmpdir(), 'sealsend-qa-'));
  const path = join(dir, 'sealsend.db');
  const sqlite = openSqliteDb(path);
  // WAL lets the app read while the harness writes; wait instead of failing on a busy file.
  sqlite.handle.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  process.env.SQLITE_PATH = path;
  let closed = false;
  const db: QaDb = {
    path,
    query: async <T = Record<string, unknown>>(sql: string, values?: unknown[]) => ({ rows: await sqlite.query<T>(sql, values) }),
    batch: (statements) => sqlite.batch(statements),
    exec: (sql) => sqlite.exec(sql),
    close: async () => { if (closed) return; closed = true; sqlite.handle.close(); },
  };
  await db.exec(await readFile('src/lib/db/schema.sql', 'utf8'));
  const owner = '00000000-0000-4000-8000-000000000010';
  const event = '00000000-0000-4000-8000-000000000011';
  const guest = '00000000-0000-4000-8000-000000000012';
  const other = '00000000-0000-4000-8000-000000000013';
  const builderOwner = '00000000-0000-4000-8000-000000000020';
  const password = await hash('Local-QA-only-Password-42', 10);
  await db.query('INSERT INTO admin_users(id,email,name,password) VALUES ($1,$2,$3,$4),($5,$6,$7,$4)', [owner, 'social-qa@example.test', 'Social QA', password, builderOwner, 'builder-qa@example.test', 'Builder QA']);
  await db.query("INSERT INTO events(id,user_id,title,slug,status,event_date,event_timezone,location_name,location_address,host_name) VALUES ($1,$2,'Social QA event','social-qa','published',strftime('%Y-%m-%dT%H:%M:%fZ','now','+14 days'),'America/Toronto','QA Hall','123 Example Street','QA Host')", [event, owner]);
  await db.query("INSERT INTO guests(id,event_id,name,email,invite_token,invite_status) VALUES ($1,$2,'Invited Guest','guest@example.test',$3,'sent'),($4,$2,'Other Guest','other@example.test',$5,'sent')", [guest, event, 'a'.repeat(24), other, 'b'.repeat(24)]);
  await db.query("INSERT INTO rsvp_responses(event_id,guest_id,respondent_name,status,headcount) VALUES ($1,$2,'Invited Guest','attending',1)", [event, guest]);
  await db.query('INSERT INTO event_social_settings(event_id,guests_enabled,reactions_enabled,polls_enabled,photos_enabled,countdown_enabled) VALUES ($1,true,true,true,true,true)', [event]);
  await db.query("INSERT INTO event_social_polls(event_id,question,options) VALUES ($1,'Which snack?', '[\"Fruit\",\"Crackers\"]')", [event]);
  await db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'admin','social-local-host-session',strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day'))", [owner]);
  let stopped = false;
  const server = {
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await db.close();
      // On Windows an app still holding the file keeps the directory busy; leave it to the OS temp cleanup.
      await rm(dir, { recursive: true, force: true }).catch(() => console.warn(`Could not remove ${dir}; delete it once the app has stopped.`));
    },
  };
  console.log(`Synthetic local QA database ready: SQLITE_PATH=${path}`);
  return { db, server };
}

if (process.argv[1]?.endsWith('start-social-qa.ts')) {
  void startSocialQa().then(({ server }) => {
    console.log('Start the app with that SQLITE_PATH in another terminal. Ctrl+C stops and deletes the database.');
    const keepAlive = setInterval(() => undefined, 60_000);
    const stop = async () => { clearInterval(keepAlive); await server.stop(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }).catch(error => { console.error(error); process.exit(1); });
}

import { readFileSync } from 'fs';
import { join } from 'path';
import { getDb } from './client';

export async function runMigrations() {
  const db = getDb();
  const schema = readFileSync(join(process.cwd(), 'src/lib/db/schema.sql'), 'utf-8');
  await db.query(schema);
  console.log('Migrations complete');
}

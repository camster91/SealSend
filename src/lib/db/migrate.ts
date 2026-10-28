import { readFileSync } from 'fs';
import { join } from 'path';
import { exec } from './client';

export async function runMigrations() {
  const schema = readFileSync(join(process.cwd(), 'src/lib/db/schema.sql'), 'utf-8');
  await exec(schema);
  console.log('Migrations complete');
}

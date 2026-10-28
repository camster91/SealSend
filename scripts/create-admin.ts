#!/usr/bin/env tsx
/**
 * Create an admin user in the database
 * Usage: SEALSEND_ADMIN_PASSWORD=... npx tsx scripts/create-admin.ts <email>
 * Local SQLite by default (SQLITE_PATH); production D1 with D1_REMOTE=true plus
 * CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID and CLOUDFLARE_API_TOKEN.
 */

import { query, queryOne } from '../src/lib/db/client';
import { checkPasswordStrength, hashPassword } from '../src/lib/password';
import { DATABASE_TARGET_HELP, isoText, requireCliDatabase } from './lib/cli-database';

const adminPassword = process.env.SEALSEND_ADMIN_PASSWORD;
const adminName = process.env.SEALSEND_ADMIN_NAME?.trim() || 'SealSend Operator';

requireCliDatabase();

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !adminPassword) {
  console.error('Usage: set SEALSEND_ADMIN_PASSWORD, then pass the admin email');
  console.error(DATABASE_TARGET_HELP);
  process.exit(1);
}

if (!checkPasswordStrength(adminPassword).valid) {
  console.error('Error: SEALSEND_ADMIN_PASSWORD does not meet the application password policy');
  process.exit(1);
}

const verifiedAdminPassword = adminPassword;

interface AdminUser {
  id: string;
  email: string;
  created_at: Date;
}

async function createAdmin() {
  console.log(`Creating admin user: ${email}`);

  try {
    // Check if admin already exists
    const existing = await queryOne<AdminUser>(
      'SELECT id, email FROM admin_users WHERE email = $1',
      [email]
    );

    if (existing) {
      console.log(`Admin user already exists: ${existing.email}`);
      return;
    }

    const passwordHash = await hashPassword(verifiedAdminPassword);
    const [data] = await query<AdminUser>(
      'INSERT INTO admin_users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, created_at',
      [email, passwordHash, adminName]
    );

    console.log(`Admin user created successfully!`);
    console.log(`   ID: ${data.id}`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Created: ${isoText(data.created_at)}`);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();

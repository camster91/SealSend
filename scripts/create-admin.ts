#!/usr/bin/env tsx
/**
 * Create an admin user in the database
 * Usage: SEALSEND_ADMIN_PASSWORD=... npx tsx scripts/create-admin.ts <email>
 */

import { Pool } from 'pg';
import { checkPasswordStrength, hashPassword } from '../src/lib/password';

const databaseUrl = process.env.DATABASE_URL;
const adminPassword = process.env.SEALSEND_ADMIN_PASSWORD;
const adminName = process.env.SEALSEND_ADMIN_NAME?.trim() || 'SealSend Operator';

if (!databaseUrl) {
  console.error('Error: Missing DATABASE_URL environment variable');
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !adminPassword) {
  console.error('Usage: set DATABASE_URL and SEALSEND_ADMIN_PASSWORD, then pass the admin email');
  process.exit(1);
}

if (!checkPasswordStrength(adminPassword).valid) {
  console.error('Error: SEALSEND_ADMIN_PASSWORD does not meet the application password policy');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

async function createAdmin() {
  console.log(`Creating admin user: ${email}`);

  try {
    // Check if admin already exists
    const checkResult = await pool.query<AdminUser>(
      'SELECT id, email FROM admin_users WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length > 0) {
      console.log(`Admin user already exists: ${checkResult.rows[0].email}`);
      return;
    }

    const passwordHash = await hashPassword(adminPassword);
    const insertResult = await pool.query<AdminUser>(
      'INSERT INTO admin_users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, created_at',
      [email, passwordHash, adminName]
    );

    const data = insertResult.rows[0];
    console.log(`Admin user created successfully!`);
    console.log(`   ID: ${data.id}`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Created: ${data.created_at}`);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();

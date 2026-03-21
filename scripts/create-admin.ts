#!/usr/bin/env tsx
/**
 * Create an admin user in the database
 * Usage: npx tsx scripts/create-admin.ts <email>
 */

import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: Missing DATABASE_URL environment variable');
  process.exit(1);
}

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email>');
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
      const existing = checkResult.rows[0];
      console.log(`Admin user already exists: ${existing.email}`);
      process.exit(0);
    }

    // Create admin user
    const insertResult = await pool.query<AdminUser>(
      'INSERT INTO admin_users (email) VALUES ($1) RETURNING id, email, created_at',
      [email]
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

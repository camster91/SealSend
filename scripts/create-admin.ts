#!/usr/bin/env tsx
/**
 * Create an admin user in the database
 * Usage: npx tsx scripts/create-admin.ts <email> [password]
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: Missing DATABASE_URL environment variable');
  process.exit(1);
}

const email = process.argv[2];
const password = process.argv[3];

if (!email) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email> [password]');
  process.exit(1);
}

async function createAdmin() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  try {
    console.log(`Creating admin user: ${email}`);

    const existing = await prisma.adminUser.findUnique({ where: { email } });

    if (existing) {
      console.log(`Admin user already exists: ${existing.email}`);
      process.exit(0);
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 12)
      : await bcrypt.hash(crypto.randomUUID(), 12);

    const data = await prisma.adminUser.create({
      data: { email, password: hashedPassword },
    });

    console.log(`Admin user created successfully!`);
    console.log(`   ID: ${data.id}`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Created: ${data.created_at}`);
    if (!password) {
      console.log(`   Note: Random password set. Use the app to set a real password.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

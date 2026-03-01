#!/usr/bin/env tsx
/**
 * Create an admin user in the database
 * Usage: npx tsx scripts/create-admin.ts <email>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email>');
  process.exit(1);
}

async function createAdmin() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`Creating admin user: ${email}`);

  // Check if admin already exists
  const { data: existing, error: checkError } = await supabase
    .from('admin_users')
    .select('id, email')
    .eq('email', email)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('Error checking existing admin:', checkError);
    process.exit(1);
  }

  if (existing) {
    console.log(`Admin user already exists: ${existing.email}`);
    process.exit(0);
  }

  // Create admin user
  const { data, error } = await supabase
    .from('admin_users')
    .insert({ email })
    .select()
    .single();

  if (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }

  console.log(`✅ Admin user created successfully!`);
  console.log(`   ID: ${data.id}`);
  console.log(`   Email: ${data.email}`);
  console.log(`   Created: ${data.created_at}`);
}

createAdmin();

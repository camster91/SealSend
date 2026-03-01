/**
 * Admin user creation script
 * Usage: npx tsx scripts/create-admin.ts email@example.com "Full Name" "password"
 */

import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../src/lib/password';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createAdmin() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: npx tsx scripts/create-admin.ts <email> "<full name>" "<password>"');
    console.log('Example: npx tsx scripts/create-admin.ts admin@example.com "John Doe" "SecurePass123!"');
    process.exit(1);
  }

  const [email, name, password] = args;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Error: Missing Supabase environment variables');
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Validate password strength
  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    process.exit(1);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Insert admin user
    const { data, error } = await supabase
      .from('admin_users')
      .insert({
        email,
        name,
        password: hashedPassword,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        console.error(`Error: Admin with email ${email} already exists`);
      } else {
        console.error('Error creating admin:', error.message);
      }
      process.exit(1);
    }

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${data.email}`);
    console.log(`   Name: ${data.name}`);
    console.log(`   ID: ${data.id}`);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

createAdmin();

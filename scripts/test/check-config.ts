#!/usr/bin/env node
/**
 * Configuration Check Script
 * Verifies all required environment variables are set
 * 
 * Usage:
 *   npx tsx scripts/test/check-config.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

interface ConfigCheck {
  name: string;
  required: boolean;
  value?: string;
  isDefault?: boolean;
  valid: boolean;
  error?: string;
}

function checkConfig(): ConfigCheck[] {
  const checks: ConfigCheck[] = [];

  // Supabase
  checks.push({
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    value: process.env.NEXT_PUBLIC_SUPABASE_URL,
    valid: !!process.env.NEXT_PUBLIC_SUPABASE_URL && 
           !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('your-supabase-url'),
    error: !process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Not set' : 'Contains placeholder value',
  });

  checks.push({
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    value: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) + '...',
    valid: !!process.env.SUPABASE_SERVICE_ROLE_KEY && 
           !process.env.SUPABASE_SERVICE_ROLE_KEY?.includes('your-service-role-key'),
    error: !process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Not set' : 
           process.env.SUPABASE_SERVICE_ROLE_KEY?.includes('your-service-role-key') ? 'Contains placeholder value' : undefined,
  });

  checks.push({
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20) + '...',
    valid: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    error: !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Not set' : undefined,
  });

  // Email (Resend)
  checks.push({
    name: 'RESEND_API_KEY',
    required: false,
    value: process.env.RESEND_API_KEY?.slice(0, 15) + '...',
    valid: !!process.env.RESEND_API_KEY && 
           process.env.RESEND_API_KEY !== 'your-resend-api-key' &&
           process.env.RESEND_API_KEY?.startsWith('re_'),
    error: process.env.RESEND_API_KEY === 'your-resend-api-key' ? 'Contains placeholder value' :
           process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY?.startsWith('re_') ? 'Should start with re_' : undefined,
  });

  checks.push({
    name: 'FROM_EMAIL',
    required: false,
    value: process.env.FROM_EMAIL,
    isDefault: !process.env.FROM_EMAIL,
    valid: true, // Has default value
    error: undefined,
  });

  // SMS (Twilio)
  checks.push({
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    value: process.env.TWILIO_ACCOUNT_SID,
    valid: !!process.env.TWILIO_ACCOUNT_SID && 
           process.env.TWILIO_ACCOUNT_SID?.startsWith('AC_'),
    error: process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID?.startsWith('AC_') ? 'Should start with AC_' : undefined,
  });

  const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
  const hasApiKey = !!process.env.TWILIO_API_KEY_SID && !!process.env.TWILIO_API_KEY_SECRET;

  checks.push({
    name: 'TWILIO_AUTH_TOKEN',
    required: false,
    value: process.env.TWILIO_AUTH_TOKEN ? '***' : undefined,
    valid: !process.env.TWILIO_ACCOUNT_SID || hasAuthToken || hasApiKey,
    error: process.env.TWILIO_ACCOUNT_SID && !hasAuthToken && !hasApiKey ? 'Either TWILIO_AUTH_TOKEN or (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET) required' : undefined,
  });

  checks.push({
    name: 'TWILIO_API_KEY_SID',
    required: false,
    value: process.env.TWILIO_API_KEY_SID,
    valid: true, // Optional
    error: undefined,
  });

  checks.push({
    name: 'TWILIO_API_KEY_SECRET',
    required: false,
    value: process.env.TWILIO_API_KEY_SECRET ? '***' : undefined,
    valid: true, // Optional
    error: undefined,
  });

  const hasMessagingService = !!process.env.TWILIO_MESSAGING_SERVICE_SID;
  const hasFromNumber = !!process.env.TWILIO_FROM_NUMBER;

  checks.push({
    name: 'TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER',
    required: false,
    value: process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER,
    valid: !process.env.TWILIO_ACCOUNT_SID || hasMessagingService || hasFromNumber,
    error: process.env.TWILIO_ACCOUNT_SID && !hasMessagingService && !hasFromNumber ? 
           'Either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER required' : undefined,
  });

  // App
  checks.push({
    name: 'NEXT_PUBLIC_SITE_URL',
    required: false,
    value: process.env.NEXT_PUBLIC_SITE_URL,
    isDefault: !process.env.NEXT_PUBLIC_SITE_URL,
    valid: true, // Has default value
    error: undefined,
  });

  return checks;
}

function main(): void {
  console.log('🔍 SealSend Configuration Check\n');
  console.log('═══════════════════════════════════════\n');

  const checks = checkConfig();
  const requiredChecks = checks.filter(c => c.required);
  const optionalChecks = checks.filter(c => !c.required);

  // Required checks
  console.log('📋 Required Configuration\n');
  let requiredValid = 0;
  requiredChecks.forEach(check => {
    const icon = check.valid ? '✅' : '❌';
    const value = check.value || 'Not set';
    console.log(`${icon} ${check.name}`);
    console.log(`   Value: ${value}`);
    if (check.error) {
      console.log(`   ⚠️  ${check.error}`);
    }
    console.log('');
    if (check.valid) requiredValid++;
  });

  // Optional checks
  console.log('📋 Optional Configuration\n');
  let optionalValid = 0;
  let optionalTotal = 0;
  optionalChecks.forEach(check => {
    if (check.name.includes('or')) {
      // Combined checks
      const icon = check.valid ? '✅' : '⚠️';
      const value = check.value || 'Not set';
      console.log(`${icon} ${check.name}`);
      console.log(`   Value: ${value}`);
      if (check.error) {
        console.log(`   ⚠️  ${check.error}`);
      }
      console.log('');
      optionalTotal++;
      if (check.valid) optionalValid++;
    } else {
      const icon = check.valid ? '✅' : '⚠️';
      const value = check.value || 'Not set';
      const note = check.isDefault ? ' (using default)' : '';
      console.log(`${icon} ${check.name}${note}`);
      console.log(`   Value: ${value}`);
      if (check.error) {
        console.log(`   ⚠️  ${check.error}`);
      }
      console.log('');
      optionalTotal++;
      if (check.valid) optionalValid++;
    }
  });

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('📊 Summary\n');
  console.log(`Required: ${requiredValid}/${requiredChecks.length} configured`);
  console.log(`Optional: ${optionalValid}/${optionalTotal} configured`);

  const allRequiredValid = requiredValid === requiredChecks.length;

  if (allRequiredValid) {
    console.log('\n✅ All required configuration is set!');
    
    const hasEmail = checks.find(c => c.name === 'RESEND_API_KEY')?.valid;
    const hasSms = checks.find(c => c.name === 'TWILIO_ACCOUNT_SID')?.valid;

    console.log('\n📧 Email (Resend):', hasEmail ? '✅ Configured' : '⚠️ Not configured');
    console.log('📱 SMS (Twilio):', hasSms ? '✅ Configured' : '⚠️ Not configured');

    if (hasEmail && hasSms) {
      console.log('\n🎉 You can run all tests:');
      console.log('   npx tsx scripts/test/test-all.ts --all --email your@email.com --sms +15551234567');
    } else if (hasEmail) {
      console.log('\n✉️  You can test email:');
      console.log('   npx tsx scripts/test/test-email.ts your@email.com');
    } else if (hasSms) {
      console.log('\n📱 You can test SMS:');
      console.log('   npx tsx scripts/test/test-sms.ts +15551234567');
    } else {
      console.log('\n⚠️  Configure Resend or Twilio to run tests');
    }
  } else {
    console.log('\n❌ Some required configuration is missing!');
    console.log('\n📝 To fix:');
    console.log('   1. Copy .env.example to .env.local');
    console.log('   2. Fill in the required values');
    console.log('   3. Run this check again');
    process.exit(1);
  }
}

main();

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

  // Database
  checks.push({
    name: 'DATABASE_URL',
    required: true,
    value: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^@]+@/, ':***@') : undefined,
    valid: !!process.env.DATABASE_URL &&
           process.env.DATABASE_URL.startsWith('postgresql://'),
    error: !process.env.DATABASE_URL ? 'Not set' :
           !process.env.DATABASE_URL.startsWith('postgresql://') ? 'Must start with postgresql://' : undefined,
  });

  // JWT
  checks.push({
    name: 'JWT_SECRET',
    required: true,
    value: process.env.JWT_SECRET ? '***' : undefined,
    valid: !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
    error: !process.env.JWT_SECRET ? 'Not set' :
           process.env.JWT_SECRET.length < 32 ? 'Should be at least 32 characters' : undefined,
  });

  // Email (Mailgun)
  checks.push({
    name: 'MAILGUN_API_KEY',
    required: false,
    value: process.env.MAILGUN_API_KEY ? process.env.MAILGUN_API_KEY.slice(0, 10) + '...' : undefined,
    valid: !!process.env.MAILGUN_API_KEY &&
           process.env.MAILGUN_API_KEY !== 'your-mailgun-sending-key',
    error: process.env.MAILGUN_API_KEY === 'your-mailgun-sending-key' ? 'Contains placeholder value' : undefined,
  });

  checks.push({
    name: 'FROM_EMAIL',
    required: false,
    value: process.env.FROM_EMAIL,
    isDefault: !process.env.FROM_EMAIL,
    valid: true,
    error: undefined,
  });

  // SMS (Twilio)
  checks.push({
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    value: process.env.TWILIO_ACCOUNT_SID,
    valid: !!process.env.TWILIO_ACCOUNT_SID &&
           process.env.TWILIO_ACCOUNT_SID.startsWith('AC'),
    error: process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.startsWith('AC') ? 'Should start with AC' : undefined,
  });

  const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
  const hasApiKey = !!process.env.TWILIO_API_KEY_SID && !!process.env.TWILIO_API_KEY_SECRET;

  checks.push({
    name: 'TWILIO_AUTH_TOKEN or API_KEY',
    required: false,
    value: hasAuthToken ? '***' : hasApiKey ? 'API Key configured' : undefined,
    valid: !process.env.TWILIO_ACCOUNT_SID || hasAuthToken || hasApiKey,
    error: process.env.TWILIO_ACCOUNT_SID && !hasAuthToken && !hasApiKey ? 'Either TWILIO_AUTH_TOKEN or (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET) required' : undefined,
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
    valid: true,
    error: undefined,
  });

  return checks;
}

function main(): void {
  console.log('SealSend Configuration Check\n');
  console.log('=======================================\n');

  const checks = checkConfig();
  const requiredChecks = checks.filter(c => c.required);
  const optionalChecks = checks.filter(c => !c.required);

  console.log('Required Configuration\n');
  let requiredValid = 0;
  requiredChecks.forEach(check => {
    const icon = check.valid ? '[OK]' : '[FAIL]';
    const value = check.value || 'Not set';
    console.log(`${icon} ${check.name}`);
    console.log(`   Value: ${value}`);
    if (check.error) {
      console.log(`   Warning: ${check.error}`);
    }
    console.log('');
    if (check.valid) requiredValid++;
  });

  console.log('Optional Configuration\n');
  let optionalValid = 0;
  let optionalTotal = 0;
  optionalChecks.forEach(check => {
    const icon = check.valid ? '[OK]' : '[WARN]';
    const value = check.value || 'Not set';
    const note = check.isDefault ? ' (using default)' : '';
    console.log(`${icon} ${check.name}${note}`);
    console.log(`   Value: ${value}`);
    if (check.error) {
      console.log(`   Warning: ${check.error}`);
    }
    console.log('');
    optionalTotal++;
    if (check.valid) optionalValid++;
  });

  console.log('=======================================');
  console.log('Summary\n');
  console.log(`Required: ${requiredValid}/${requiredChecks.length} configured`);
  console.log(`Optional: ${optionalValid}/${optionalTotal} configured`);

  const allRequiredValid = requiredValid === requiredChecks.length;

  if (allRequiredValid) {
    console.log('\n[OK] All required configuration is set!');

    const hasEmail = checks.find(c => c.name === 'MAILGUN_API_KEY')?.valid;
    const hasSms = checks.find(c => c.name === 'TWILIO_ACCOUNT_SID')?.valid;

    console.log('\nEmail (Mailgun):', hasEmail ? 'Configured' : 'Not configured');
    console.log('SMS (Twilio):', hasSms ? 'Configured' : 'Not configured');
  } else {
    console.log('\n[FAIL] Some required configuration is missing!');
    console.log('\nTo fix:');
    console.log('   1. Copy .env.example to .env.local');
    console.log('   2. Fill in the required values');
    console.log('   3. Run this check again');
    process.exit(1);
  }
}

main();

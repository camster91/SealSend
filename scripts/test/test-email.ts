#!/usr/bin/env node
/**
 * Email Test Script
 * Tests Mailgun email functionality including templates
 * 
 * Usage:
 *   npx tsx scripts/test/test-email.ts <email@example.com>
 * 
 * Environment:
 *   MAILGUN_API_KEY - Required
 *   MAILGUN_DOMAIN - Required
 *   FROM_EMAIL - Optional
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { sendEmail, isEmailConfigured } from '../../src/lib/email';
import { buildInvitationEmail, buildReminderEmail, buildAnnouncementEmail } from '../../src/lib/email-templates';

type TestResult = {
  name: string;
  success: boolean;
  error?: string;
  details?: unknown;
};

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEmailTests(recipientEmail: string): Promise<void> {
  console.log('🧪 SealSend Mailgun Email Test Suite\n');
  console.log(`Testing with recipient: ${recipientEmail}\n`);

  const results: TestResult[] = [];

  // Check environment
  if (!isEmailConfigured()) {
    console.error('❌ Mailgun not configured');
    console.log('\nRequired environment variables:');
    console.log('  MAILGUN_API_KEY=your-mailgun-api-key');
    console.log('  MAILGUN_DOMAIN=your-mailgun-domain');
    console.log('  FROM_EMAIL="SealSend <noreply@sealsend.app>"');
    console.log('\nGet your credentials at https://app.mailgun.com/settings/api_security');
    process.exit(1);
  }

  const fromEmail = process.env.FROM_EMAIL || 'SealSend <noreply@sealsend.app>';
  console.log(`From: ${fromEmail}\n`);

  // Test 1: Simple test email
  console.log('📧 Test 1: Sending simple test email...');
  try {
    const result = await sendEmail({
      to: recipientEmail,
      subject: 'SealSend Test - Simple Email',
      html: '<h1>Test Successful!</h1><p>Your Mailgun integration is working.</p>',
      text: 'Test Successful! Your Mailgun integration is working.',
    });

    results.push({
      name: 'Simple Test Email',
      success: true,
      details: { id: result.id },
    });
    console.log(`   ✅ Sent!`);
    console.log(`   ID: ${result.id}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({ name: 'Simple Test Email', success: false, error: message });
    console.log(`   ❌ Error: ${message}\n`);
  }

  await delay(1000); // Small delay between sends

  // Test 2: Invitation email template
  console.log('📧 Test 2: Testing invitation email template...');
  try {
    const { subject, html } = buildInvitationEmail({
      guestName: 'Test Guest',
      eventTitle: 'Test Birthday Party',
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      locationName: '123 Test Street, Test City',
      rsvpUrl: 'https://sealsend.app/e/test-event?t=testtoken123',
      designUrl: null,
      hostName: 'Test Host',
      dressCode: 'Casual',
      rsvpDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html,
    });

    results.push({
      name: 'Invitation Email Template',
      success: true,
      details: { id: result.id, subject },
    });
    console.log(`   ✅ Sent! Subject: ${subject}`);
    console.log(`   ID: ${result.id}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({ name: 'Invitation Email Template', success: false, error: message });
    console.log(`   ❌ Error: ${message}\n`);
  }

  await delay(1000);

  // Test 3: Reminder email template
  console.log('📧 Test 3: Testing reminder email template...');
  try {
    const { subject, html } = buildReminderEmail({
      guestName: 'Test Guest',
      eventTitle: 'Test Birthday Party',
      eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      locationName: '123 Test Street, Test City',
      rsvpUrl: 'https://sealsend.app/e/test-event?t=testtoken123',
    });

    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html,
    });

    results.push({
      name: 'Reminder Email Template',
      success: true,
      details: { id: result.id, subject },
    });
    console.log(`   ✅ Sent! Subject: ${subject}`);
    console.log(`   ID: ${result.id}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({ name: 'Reminder Email Template', success: false, error: message });
    console.log(`   ❌ Error: ${message}\n`);
  }

  await delay(1000);

  // Test 4: Announcement email template
  console.log('📧 Test 4: Testing announcement email template...');
  try {
    const { subject, html } = buildAnnouncementEmail({
      guestName: 'Test Guest',
      eventTitle: 'Test Birthday Party',
      announcementSubject: 'Venue Change',
      announcementMessage: 'The party has been moved to a new location. Please check the updated details on the event page.',
      rsvpUrl: 'https://sealsend.app/e/test-event?t=testtoken123',
    });

    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html,
    });

    results.push({
      name: 'Announcement Email Template',
      success: true,
      details: { id: result.id, subject },
    });
    console.log(`   ✅ Sent! Subject: ${subject}`);
    console.log(`   ID: ${result.id}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({ name: 'Announcement Email Template', success: false, error: message });
    console.log(`   ❌ Error: ${message}\n`);
  }

  // Test 5: Invalid email handling
  console.log('📧 Test 5: Testing invalid email handling...');
  try {
    const result = await sendEmail({
      to: 'invalid-email-format',
      subject: 'This should fail',
      html: '<p>Test</p>',
    });

    results.push({
      name: 'Invalid Email Handling',
      success: false,
      error: 'Should have rejected invalid email',
    });
    console.log(`   ❌ Should have rejected invalid email\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({
      name: 'Invalid Email Handling',
      success: true,
      details: { error: message },
    });
    console.log(`   ✅ Correctly rejected: ${message}\n`);
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Test Summary\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n${passed}/${results.length} tests passed`);

  if (failed > 0) {
    console.log(`\n⚠️ ${failed} test(s) failed`);
    console.log('\nTroubleshooting:');
    console.log('  1. Check Mailgun dashboard for error details');
    console.log('  2. Verify your API key is valid');
    console.log('  3. Check if the recipient email is valid');
    console.log('  4. Ensure your domain is verified in Mailgun');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Check your inbox for the test emails');
    console.log('   2. Verify the templates render correctly');
    console.log('   3. Check Mailgun dashboard for delivery status');
    console.log('   4. Visit https://app.mailgun.com/sending/domains');
  }
}

// Run tests
const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('❌ Please provide an email address');
  console.log('\nUsage: npx tsx scripts/test/test-email.ts <email@example.com>');
  process.exit(1);
}

if (!recipientEmail.includes('@')) {
  console.error('❌ Invalid email address');
  process.exit(1);
}

runEmailTests(recipientEmail).catch(console.error);

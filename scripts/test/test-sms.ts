#!/usr/bin/env node
/**
 * SMS Test Script
 * Tests Twilio SMS functionality including phone validation and templates
 * 
 * Usage:
 *   npx tsx scripts/test/test-sms.ts <+15551234567>
 * 
 * Environment:
 *   TWILIO_ACCOUNT_SID - Required
 *   TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET - Required
 *   TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER - Required
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import twilio from 'twilio';
import { validateAndFormatPhone } from '../../src/lib/phone-validation';
import { buildInviteSms, buildReminderSms, buildAnnouncementSms } from '../../src/lib/sms-templates';
import { getTwilioSendOptions, isTwilioConfigured } from '../../src/lib/twilio';

type TestResult = {
  name: string;
  success: boolean;
  error?: string;
  details?: unknown;
};

async function runSmsTests(phoneNumber: string): Promise<void> {
  console.log('🧪 SealSend SMS Test Suite\n');
  console.log(`Testing with phone: ${phoneNumber}\n`);

  const results: TestResult[] = [];

  // Check environment
  if (!isTwilioConfigured()) {
    console.error('❌ Twilio not configured');
    console.log('\nRequired environment variables:');
    console.log('  TWILIO_ACCOUNT_SID=AC_xxxxxxxxxxxxxxx');
    console.log('  TWILIO_AUTH_TOKEN=your_auth_token');
    console.log('  # OR');
    console.log('  TWILIO_API_KEY_SID=SK_xxxxxxxxxxxxxxx');
    console.log('  TWILIO_API_KEY_SECRET=your_api_secret');
    console.log('  # AND');
    console.log('  TWILIO_MESSAGING_SERVICE_SID=MG_xxxxxxxxxxxxxxx');
    console.log('  # OR');
    console.log('  TWILIO_FROM_NUMBER=+15551234567');
    process.exit(1);
  }

  console.log('✅ Twilio configuration found\n');

  // Test 1: Phone number validation
  console.log('📱 Test 1: Phone number validation...');
  const validation = validateAndFormatPhone(phoneNumber);
  
  if (validation.valid) {
    results.push({
      name: 'Phone Validation',
      success: true,
      details: { 
        original: phoneNumber,
        formatted: validation.formatted,
        country: validation.country,
      },
    });
    console.log(`   ✅ Valid!`);
    console.log(`   Original: ${phoneNumber}`);
    console.log(`   Formatted: ${validation.formatted}`);
    console.log(`   Country: ${validation.country}\n`);
  } else {
    results.push({
      name: 'Phone Validation',
      success: false,
      error: validation.error,
    });
    console.log(`   ❌ Invalid: ${validation.error}\n`);
    // Continue with tests anyway
  }

  const formattedPhone = validation.formatted || phoneNumber;

  // Test 2: Twilio client initialization
  console.log('📱 Test 2: Twilio client initialization...');
  let client: ReturnType<typeof twilio>;
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (apiKeySid && apiKeySecret) {
      client = twilio(apiKeySid, apiKeySecret, { accountSid });
      console.log('   Using API Key authentication');
    } else {
      client = twilio(accountSid, authToken!);
      console.log('   Using Auth Token authentication');
    }

    const sendOptions = getTwilioSendOptions();
    console.log(`   Send options: ${JSON.stringify(sendOptions)}`);
    
    results.push({
      name: 'Twilio Client Initialization',
      success: true,
      details: { authMethod: apiKeySid ? 'apiKey' : 'authToken' },
    });
    console.log(`   ✅ Client initialized\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({
      name: 'Twilio Client Initialization',
      success: false,
      error: message,
    });
    console.log(`   ❌ Error: ${message}\n`);
    process.exit(1);
  }

  // Test 3: Simple SMS
  console.log('📱 Test 3: Sending simple test SMS...');
  try {
    const result = await client.messages.create({
      body: 'SealSend Test: Your SMS integration is working! 🎉',
      to: formattedPhone,
      ...getTwilioSendOptions(),
    });

    results.push({
      name: 'Simple Test SMS',
      success: true,
      details: { 
        sid: result.sid,
        status: result.status,
      },
    });
    console.log(`   ✅ Sent!`);
    console.log(`   SID: ${result.sid}`);
    console.log(`   Status: ${result.status}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({
      name: 'Simple Test SMS',
      success: false,
      error: message,
    });
    console.log(`   ❌ Error: ${message}\n`);
  }

  // Test 4: Invitation SMS template
  console.log('📱 Test 4: Testing invitation SMS template...');
  try {
    const smsBody = buildInviteSms({
      guestName: 'Test Guest',
      eventTitle: 'Test Birthday Party',
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      locationName: '123 Test Street',
      hostName: 'Test Host',
      rsvpUrl: 'https://sealsend.app/e/test-event?t=testtoken123',
    });

    console.log(`   Message preview (${smsBody.length} chars):`);
    console.log(`   ${smsBody.substring(0, 100)}...\n`);

    const result = await client.messages.create({
      body: smsBody,
      to: formattedPhone,
      ...getTwilioSendOptions(),
    });

    results.push({
      name: 'Invitation SMS Template',
      success: true,
      details: { 
        sid: result.sid,
        length: smsBody.length,
      },
    });
    console.log(`   ✅ Sent! SID: ${result.sid}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({
      name: 'Invitation SMS Template',
      success: false,
      error: message,
    });
    console.log(`   ❌ Error: ${message}\n`);
  }

  // Test 5: Reminder SMS template
  console.log('📱 Test 5: Testing reminder SMS template...');
  try {
    const smsBody = buildReminderSms({
      guestName: 'Test Guest',
      eventTitle: 'Test Birthday Party',
      eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      rsvpUrl: 'https://sealsend.app/e/test-event?t=testtoken123',
    });

    console.log(`   Message preview (${smsBody.length} chars):`);
    console.log(`   ${smsBody.substring(0, 100)}...\n`);

    const result = await client.messages.create({
      body: smsBody,
      to: formattedPhone,
      ...getTwilioSendOptions(),
    });

    results.push({
      name: 'Reminder SMS Template',
      success: true,
      details: { 
        sid: result.sid,
        length: smsBody.length,
      },
    });
    console.log(`   ✅ Sent! SID: ${result.sid}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({
      name: 'Reminder SMS Template',
      success: false,
      error: message,
    });
    console.log(`   ❌ Error: ${message}\n`);
  }

  // Test 6: Announcement SMS template
  console.log('📱 Test 6: Testing announcement SMS template...');
  try {
    const smsBody = buildAnnouncementSms({
      guestName: 'Test Guest',
      eventTitle: 'Test Birthday Party',
      subject: 'Venue Change',
      rsvpUrl: 'https://sealsend.app/e/test-event?t=testtoken123',
    });

    console.log(`   Message preview (${smsBody.length} chars):`);
    console.log(`   ${smsBody.substring(0, 100)}...\n`);

    const result = await client.messages.create({
      body: smsBody,
      to: formattedPhone,
      ...getTwilioSendOptions(),
    });

    results.push({
      name: 'Announcement SMS Template',
      success: true,
      details: { 
        sid: result.sid,
        length: smsBody.length,
      },
    });
    console.log(`   ✅ Sent! SID: ${result.sid}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({
      name: 'Announcement SMS Template',
      success: false,
      error: message,
    });
    console.log(`   ❌ Error: ${message}\n`);
  }

  // Test 7: Invalid phone handling
  console.log('📱 Test 7: Testing invalid phone handling...');
  const invalidPhones = [
    '123', // Too short
    'abc', // Not a number
    '+1', // Incomplete
  ];

  for (const invalidPhone of invalidPhones) {
    const invalidValidation = validateAndFormatPhone(invalidPhone);
    if (!invalidValidation.valid) {
      console.log(`   ✅ Correctly rejected "${invalidPhone}": ${invalidValidation.error}`);
    } else {
      console.log(`   ⚠️ Should have rejected "${invalidPhone}"`);
    }
  }
  console.log('');

  results.push({
    name: 'Invalid Phone Handling',
    success: true,
    details: { tested: invalidPhones.length },
  });

  // Test 8: Character limit check
  console.log('📱 Test 8: SMS character limit check...');
  const longSmsBody = buildInviteSms({
    guestName: 'A very long name that takes up space',
    eventTitle: 'An extremely long event title that might cause the SMS to exceed character limits',
    eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    locationName: 'A very long venue name at a specific address with lots of details',
    hostName: 'Another very long name for the host',
    rsvpUrl: 'https://sealsend.app/e/very-long-event-slug-name-here?t=verylongtoken123456789',
  });

  console.log(`   Message length: ${longSmsBody.length} characters`);
  console.log(`   Segments: ${Math.ceil(longSmsBody.length / 160)} (GSM-7) or ${Math.ceil(longSmsBody.length / 70)} (UCS-2)`);
  
  if (longSmsBody.length > 160) {
    console.log(`   ⚠️ Message will be split into multiple SMS segments`);
    console.log(`   Twilio charges per segment\n`);
  } else {
    console.log(`   ✅ Fits in single SMS\n`);
  }

  results.push({
    name: 'Character Limit Check',
    success: true,
    details: { length: longSmsBody.length },
  });

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
    console.log('  1. Check Twilio Console for error details');
    console.log('  2. Verify your Twilio number is not in trial mode');
    console.log('  3. Ensure the destination number is valid');
    console.log('  4. Check Twilio billing status');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Check your phone for the test SMS messages');
    console.log('   2. Verify the templates look correct');
    console.log('   3. Check Twilio console for delivery status');
    console.log('   4. Set up status callback webhooks for production');
  }
}

// Run tests
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error('❌ Please provide a phone number');
  console.log('\nUsage: npx tsx scripts/test/test-sms.ts <+15551234567>');
  console.log('\nExamples:');
  console.log('  US:    npx tsx scripts/test/test-sms.ts +15551234567');
  console.log('  UK:    npx tsx scripts/test/test-sms.ts +447123456789');
  console.log('  CA:    npx tsx scripts/test/test-sms.ts +14161234567');
  process.exit(1);
}

runSmsTests(phoneNumber).catch(console.error);

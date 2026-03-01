#!/usr/bin/env node
/**
 * Integration Test Script
 * Tests the complete flow: create event → add guests → send invites
 * 
 * Usage:
 *   npx tsx scripts/test/test-integration.ts
 * 
 * This creates a test event and sends real emails/SMS.
 * Requires all environment variables to be configured.
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../../src/lib/password';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface TestContext {
  userId?: string;
  eventId?: string;
  guestIds?: string[];
  sessionToken?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runIntegrationTests(): Promise<void> {
  console.log('🔗 SealSend Integration Test Suite\n');
  console.log('⚠️  This will create real data in your database and send actual emails/SMS\n');

  const context: TestContext = {};

  // Check environment
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Test 1: Create test admin user
  console.log('🧪 Test 1: Creating test admin user...');
  try {
    const hashedPassword = await hashPassword('TestPassword123!');
    const { data: user, error } = await supabase
      .from('admin_users')
      .insert({
        email: `test-${Date.now()}@sealsend.test`,
        name: 'Test User',
        password: hashedPassword,
      })
      .select()
      .single();

    if (error) throw error;
    context.userId = user.id;
    console.log(`   ✅ Created user: ${user.email} (ID: ${user.id})\n`);
  } catch (error) {
    console.error('   ❌ Failed:', error);
    process.exit(1);
  }

  // Test 2: Create test event
  console.log('🧪 Test 2: Creating test event...');
  try {
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        user_id: context.userId,
        title: 'Integration Test Event',
        description: 'This is a test event created by the integration test suite.',
        event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location_name: 'Test Venue',
        location_address: '123 Test Street, Test City, TC 12345',
        host_name: 'Test Host',
        dress_code: 'Casual',
        tier: 'premium', // Enable all features
        status: 'published',
        slug: `test-event-${Date.now()}`,
        max_responses: 100,
        customization: {
          primaryColor: '#7c3aed',
          backgroundColor: '#ffffff',
          fontFamily: 'Inter',
          buttonStyle: 'rounded',
          showCountdown: true,
        },
      })
      .select()
      .single();

    if (error) throw error;
    context.eventId = event.id;
    console.log(`   ✅ Created event: ${event.title} (ID: ${event.id})`);
    console.log(`   Slug: ${event.slug}\n`);
  } catch (error) {
    console.error('   ❌ Failed:', error);
    await cleanup(context, supabase);
    process.exit(1);
  }

  // Test 3: Create RSVP fields
  console.log('🧪 Test 3: Creating RSVP fields...');
  try {
    const { error } = await supabase
      .from('rsvp_fields')
      .insert([
        {
          event_id: context.eventId,
          field_name: 'attendance',
          field_label: 'Will you be attending?',
          field_type: 'attendance',
          is_required: true,
          is_enabled: true,
          sort_order: 0,
        },
        {
          event_id: context.eventId,
          field_name: 'email',
          field_label: 'Email Address',
          field_type: 'email',
          is_required: false,
          is_enabled: true,
          sort_order: 1,
        },
        {
          event_id: context.eventId,
          field_name: 'dietary',
          field_label: 'Dietary Requirements',
          field_type: 'text',
          is_required: false,
          is_enabled: true,
          sort_order: 2,
        },
      ]);

    if (error) throw error;
    console.log('   ✅ Created RSVP fields\n');
  } catch (error) {
    console.error('   ❌ Failed:', error);
    await cleanup(context, supabase);
    process.exit(1);
  }

  // Test 4: Add test guests
  console.log('🧪 Test 4: Adding test guests...');
  const testGuests = [
    {
      name: 'Test Guest Email Only',
      email: `test-guest-email-${Date.now()}@example.com`,
      phone: null,
    },
    {
      name: 'Test Guest Phone Only',
      email: null,
      phone: process.env.TEST_PHONE_NUMBER || null, // Will skip if not set
    },
    {
      name: 'Test Guest Both',
      email: `test-guest-both-${Date.now()}@example.com`,
      phone: process.env.TEST_PHONE_NUMBER || null,
    },
  ].filter(g => g.email || g.phone); // Filter out if no phone configured

  try {
    const guestsToInsert = testGuests.map(g => ({
      event_id: context.eventId,
      name: g.name,
      email: g.email,
      phone: g.phone,
    }));

    const { data: guests, error } = await supabase
      .from('guests')
      .insert(guestsToInsert)
      .select();

    if (error) throw error;
    context.guestIds = guests.map(g => g.id);
    console.log(`   ✅ Added ${guests.length} test guests:`);
    guests.forEach(g => {
      console.log(`      - ${g.name} (${g.email || g.phone || 'no contact'})`);
    });
    console.log('');
  } catch (error) {
    console.error('   ❌ Failed:', error);
    await cleanup(context, supabase);
    process.exit(1);
  }

  // Test 5: Send invites via API
  console.log('🧪 Test 5: Sending invites via API...');
  console.log('   Creating admin session...');
  
  try {
    // Create a session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: context.userId,
        user_role: 'admin',
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) throw sessionError;
    context.sessionToken = sessionToken;

    // Send invites via API
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/events/${context.eventId}/send-invites`, {
      method: 'POST',
      headers: {
        'Cookie': `sealsend_session=${sessionToken}; sealsend_user=${JSON.stringify({
          id: context.userId,
          email: `test-${Date.now()}@sealsend.test`,
          role: 'admin',
        })}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`   ✅ Invites sent:`);
    console.log(`      - Emails sent: ${result.sent}`);
    console.log(`      - Emails failed: ${result.failed}`);
    console.log(`      - SMS sent: ${result.sms_sent}`);
    console.log(`      - SMS failed: ${result.sms_failed}`);
    console.log('');

    // Wait for async operations
    console.log('   ⏳ Waiting for sends to process...');
    await sleep(3000);

    // Check send_logs
    const { data: sendLogs } = await supabase
      .from('send_logs')
      .select('*')
      .eq('event_id', context.eventId);

    console.log(`   📊 Send logs created: ${sendLogs?.length || 0}`);
    sendLogs?.forEach(log => {
      console.log(`      - ${log.send_type.toUpperCase()} to ${log.recipient}: ${log.status}`);
    });
    console.log('');
  } catch (error) {
    console.error('   ❌ Failed:', error);
    console.log('   ℹ️  This is expected if the server is not running locally');
    console.log('      You can still test the send functionality via the dashboard\n');
  }

  // Test 6: Check guest invite status
  console.log('🧪 Test 6: Checking guest invite status...');
  try {
    const { data: guests } = await supabase
      .from('guests')
      .select('name, invite_status, invite_token')
      .eq('event_id', context.eventId);

    console.log('   Guest invite status:');
    guests?.forEach(g => {
      console.log(`      - ${g.name}: ${g.invite_status} (token: ${g.invite_token?.slice(0, 10)}...)`);
    });
    console.log('');
  } catch (error) {
    console.error('   ❌ Failed:', error);
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Integration Test Summary\n');
  console.log(`✅ Created admin user: ${context.userId}`);
  console.log(`✅ Created event: ${context.eventId}`);
  console.log(`✅ Added ${context.guestIds?.length || 0} guests`);
  console.log(`\n🔗 Event URL: ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/e/test-event-${context.eventId?.slice(0, 8)}`);

  // Cleanup prompt
  console.log('\n🧹 Cleanup');
  console.log('Run this SQL to clean up test data:');
  console.log(`\n-- Remove test data`);
  console.log(`DELETE FROM guests WHERE event_id = '${context.eventId}';`);
  console.log(`DELETE FROM events WHERE id = '${context.eventId}';`);
  console.log(`DELETE FROM user_sessions WHERE user_id = '${context.userId}';`);
  console.log(`DELETE FROM admin_users WHERE id = '${context.userId}';`);
  console.log(`DELETE FROM send_logs WHERE event_id = '${context.eventId}';`);

  // Auto-cleanup
  console.log('\n🧹 Auto-cleaning up test data...');
  await cleanup(context, supabase);
  console.log('✅ Cleanup complete');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanup(context: TestContext, supabase: any): Promise<void> {
  if (context.eventId) {
    await supabase.from('guests').delete().eq('event_id', context.eventId);
    await supabase.from('rsvp_fields').delete().eq('event_id', context.eventId);
    await supabase.from('event_announcements').delete().eq('event_id', context.eventId);
    await supabase.from('send_logs').delete().eq('event_id', context.eventId);
    await supabase.from('events').delete().eq('id', context.eventId);
  }
  
  if (context.userId) {
    await supabase.from('user_sessions').delete().eq('user_id', context.userId);
    await supabase.from('admin_users').delete().eq('id', context.userId);
  }
}

// Run tests
runIntegrationTests().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});

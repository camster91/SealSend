#!/usr/bin/env node
/**
 * Integration Test Script
 * Tests the complete flow: create event -> add guests -> send invites
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

import { Pool } from 'pg';
import { hashPassword } from '../../src/lib/password';

const DATABASE_URL = process.env.DATABASE_URL;

interface TestContext {
  userId?: string;
  eventId?: string;
  guestIds?: string[];
  sessionToken?: string;
}

interface AdminUser {
  id: string;
  email: string;
}

interface Event {
  id: string;
  title: string;
  slug: string;
}

interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  invite_status: string;
  invite_token: string | null;
}

interface SendLog {
  send_type: string;
  recipient: string;
  status: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runIntegrationTests(): Promise<void> {
  console.log('SealSend Integration Test Suite\n');
  console.log('WARNING: This will create real data in your database and send actual emails/SMS\n');

  const context: TestContext = {};

  // Check environment
  if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test 1: Create test admin user
  console.log('Test 1: Creating test admin user...');
  try {
    const hashedPassword = await hashPassword('TestPassword123!');
    const result = await pool.query<AdminUser>(
      `INSERT INTO admin_users (email, name, password)
       VALUES ($1, $2, $3)
       RETURNING id, email`,
      [`test-${Date.now()}@sealsend.test`, 'Test User', hashedPassword]
    );

    const user = result.rows[0];
    context.userId = user.id;
    console.log(`   Created user: ${user.email} (ID: ${user.id})\n`);
  } catch (error: unknown) {
    console.error('   Failed:', error);
    await pool.end();
    process.exit(1);
  }

  // Test 2: Create test event
  console.log('Test 2: Creating test event...');
  try {
    const result = await pool.query<Event>(
      `INSERT INTO events (
        user_id, title, description, event_date, location_name,
        location_address, host_name, dress_code, tier, status,
        slug, max_responses, customization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, title, slug`,
      [
        context.userId,
        'Integration Test Event',
        'This is a test event created by the integration test suite.',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        'Test Venue',
        '123 Test Street, Test City, TC 12345',
        'Test Host',
        'Casual',
        'premium',
        'published',
        `test-event-${Date.now()}`,
        100,
        JSON.stringify({
          primaryColor: '#7c3aed',
          backgroundColor: '#ffffff',
          fontFamily: 'Inter',
          buttonStyle: 'rounded',
          showCountdown: true,
        }),
      ]
    );

    const event = result.rows[0];
    context.eventId = event.id;
    console.log(`   Created event: ${event.title} (ID: ${event.id})`);
    console.log(`   Slug: ${event.slug}\n`);
  } catch (error: unknown) {
    console.error('   Failed:', error);
    await cleanup(context, pool);
    process.exit(1);
  }

  // Test 3: Create RSVP fields
  console.log('Test 3: Creating RSVP fields...');
  try {
    await pool.query(
      `INSERT INTO rsvp_fields (event_id, field_name, field_label, field_type, is_required, is_enabled, sort_order)
       VALUES
         ($1, 'attendance', 'Will you be attending?', 'attendance', true, true, 0),
         ($1, 'email', 'Email Address', 'email', false, true, 1),
         ($1, 'dietary', 'Dietary Requirements', 'text', false, true, 2)`,
      [context.eventId]
    );

    console.log('   Created RSVP fields\n');
  } catch (error: unknown) {
    console.error('   Failed:', error);
    await cleanup(context, pool);
    process.exit(1);
  }

  // Test 4: Add test guests
  console.log('Test 4: Adding test guests...');
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
  ].filter((g): g is { name: string; email: string | null; phone: string | null } => !!(g.email || g.phone));

  try {
    const guestIds: string[] = [];
    const insertedGuests: Guest[] = [];

    for (const g of testGuests) {
      const result = await pool.query<Guest>(
        `INSERT INTO guests (event_id, name, email, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, phone, invite_status, invite_token`,
        [context.eventId, g.name, g.email, g.phone]
      );
      const guest = result.rows[0];
      guestIds.push(guest.id);
      insertedGuests.push(guest);
    }

    context.guestIds = guestIds;
    console.log(`   Added ${insertedGuests.length} test guests:`);
    insertedGuests.forEach((g: Guest) => {
      console.log(`      - ${g.name} (${g.email || g.phone || 'no contact'})`);
    });
    console.log('');
  } catch (error: unknown) {
    console.error('   Failed:', error);
    await cleanup(context, pool);
    process.exit(1);
  }

  // Test 5: Send invites via API
  console.log('Test 5: Sending invites via API...');
  console.log('   Creating admin session...');

  try {
    // Create a session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [context.userId, 'admin', sessionToken, expiresAt.toISOString()]
    );

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

    const result = await response.json() as {
      sent: number;
      failed: number;
      sms_sent: number;
      sms_failed: number;
    };
    console.log(`   Invites sent:`);
    console.log(`      - Emails sent: ${result.sent}`);
    console.log(`      - Emails failed: ${result.failed}`);
    console.log(`      - SMS sent: ${result.sms_sent}`);
    console.log(`      - SMS failed: ${result.sms_failed}`);
    console.log('');

    // Wait for async operations
    console.log('   Waiting for sends to process...');
    await sleep(3000);

    // Check send_logs
    const logResult = await pool.query<SendLog>(
      'SELECT send_type, recipient, status FROM send_logs WHERE event_id = $1',
      [context.eventId]
    );

    const sendLogs = logResult.rows;
    console.log(`   Send logs created: ${sendLogs.length}`);
    sendLogs.forEach((log: SendLog) => {
      console.log(`      - ${log.send_type.toUpperCase()} to ${log.recipient}: ${log.status}`);
    });
    console.log('');
  } catch (error: unknown) {
    console.error('   Failed:', error);
    console.log('   Note: This is expected if the server is not running locally');
    console.log('      You can still test the send functionality via the dashboard\n');
  }

  // Test 6: Check guest invite status
  console.log('Test 6: Checking guest invite status...');
  try {
    const result = await pool.query<Guest>(
      'SELECT name, invite_status, invite_token FROM guests WHERE event_id = $1',
      [context.eventId]
    );

    const guests = result.rows;
    console.log('   Guest invite status:');
    guests.forEach((g: Guest) => {
      console.log(`      - ${g.name}: ${g.invite_status} (token: ${g.invite_token?.slice(0, 10)}...)`);
    });
    console.log('');
  } catch (error: unknown) {
    console.error('   Failed:', error);
  }

  // Summary
  console.log('-----------------------------------');
  console.log('Integration Test Summary\n');
  console.log(`Created admin user: ${context.userId}`);
  console.log(`Created event: ${context.eventId}`);
  console.log(`Added ${context.guestIds?.length || 0} guests`);
  console.log(`\nEvent URL: ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/e/test-event-${context.eventId?.slice(0, 8)}`);

  // Cleanup prompt
  console.log('\nCleanup');
  console.log('Run this SQL to clean up test data:');
  console.log(`\n-- Remove test data`);
  console.log(`DELETE FROM guests WHERE event_id = '${context.eventId}';`);
  console.log(`DELETE FROM events WHERE id = '${context.eventId}';`);
  console.log(`DELETE FROM user_sessions WHERE user_id = '${context.userId}';`);
  console.log(`DELETE FROM admin_users WHERE id = '${context.userId}';`);
  console.log(`DELETE FROM send_logs WHERE event_id = '${context.eventId}';`);

  // Auto-cleanup
  console.log('\nAuto-cleaning up test data...');
  await cleanup(context, pool);
  console.log('Cleanup complete');
}

async function cleanup(context: TestContext, pool: Pool): Promise<void> {
  try {
    if (context.eventId) {
      await pool.query('DELETE FROM guests WHERE event_id = $1', [context.eventId]);
      await pool.query('DELETE FROM rsvp_fields WHERE event_id = $1', [context.eventId]);
      await pool.query('DELETE FROM event_announcements WHERE event_id = $1', [context.eventId]);
      await pool.query('DELETE FROM send_logs WHERE event_id = $1', [context.eventId]);
      await pool.query('DELETE FROM events WHERE id = $1', [context.eventId]);
    }

    if (context.userId) {
      await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [context.userId]);
      await pool.query('DELETE FROM admin_users WHERE id = $1', [context.userId]);
    }
  } finally {
    await pool.end();
  }
}

// Run tests
runIntegrationTests().catch((error: unknown) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});

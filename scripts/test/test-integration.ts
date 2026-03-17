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

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../src/lib/password';

const DATABASE_URL = process.env.DATABASE_URL;

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

  if (!DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  // Test 1: Create test admin user
  console.log('🧪 Test 1: Creating test admin user...');
  try {
    const email = `test-${Date.now()}@sealsend.test`;
    const password = 'TestPassword123!';

    const user = await prisma.adminUser.create({
      data: {
        email,
        name: 'Test User',
        password: await hashPassword(password),
      },
    });

    context.userId = user.id;
    console.log(`   ✅ Created user: ${user.email} (ID: ${user.id})\n`);
  } catch (error) {
    console.error('   ❌ Failed:', error);
    process.exit(1);
  }

  // Test 2: Create test event
  console.log('🧪 Test 2: Creating test event...');
  try {
    const event = await prisma.event.create({
      data: {
        user_id: context.userId!,
        title: 'Integration Test Event',
        description: 'This is a test event created by the integration test suite.',
        event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location_name: 'Test Venue',
        location_address: '123 Test Street, Test City, TC 12345',
        host_name: 'Test Host',
        dress_code: 'Casual',
        tier: 'premium',
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
      },
    });

    context.eventId = event.id;
    console.log(`   ✅ Created event: ${event.title} (ID: ${event.id})`);
    console.log(`   Slug: ${event.slug}\n`);
  } catch (error) {
    console.error('   ❌ Failed:', error);
    await cleanup(context, prisma);
    process.exit(1);
  }

  // Test 3: Create RSVP fields
  console.log('🧪 Test 3: Creating RSVP fields...');
  try {
    await prisma.rsvpField.createMany({
      data: [
        {
          event_id: context.eventId!,
          field_name: 'attendance',
          field_label: 'Will you be attending?',
          field_type: 'attendance',
          is_required: true,
          is_enabled: true,
          sort_order: 0,
        },
        {
          event_id: context.eventId!,
          field_name: 'email',
          field_label: 'Email Address',
          field_type: 'email',
          is_required: false,
          is_enabled: true,
          sort_order: 1,
        },
        {
          event_id: context.eventId!,
          field_name: 'dietary',
          field_label: 'Dietary Requirements',
          field_type: 'text',
          is_required: false,
          is_enabled: true,
          sort_order: 2,
        },
      ],
    });

    console.log('   ✅ Created RSVP fields\n');
  } catch (error) {
    console.error('   ❌ Failed:', error);
    await cleanup(context, prisma);
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
      phone: process.env.TEST_PHONE_NUMBER || null,
    },
    {
      name: 'Test Guest Both',
      email: `test-guest-both-${Date.now()}@example.com`,
      phone: process.env.TEST_PHONE_NUMBER || null,
    },
  ].filter(g => g.email || g.phone);

  try {
    const guestsToInsert = testGuests.map(g => ({
      event_id: context.eventId!,
      name: g.name,
      email: g.email,
      phone: g.phone,
    }));

    const guests = [];
    for (const g of guestsToInsert) {
      const created = await prisma.guest.create({ data: g });
      guests.push(created);
    }

    context.guestIds = guests.map(g => g.id);
    console.log(`   ✅ Added ${guests.length} test guests:`);
    guests.forEach(g => {
      console.log(`      - ${g.name} (${g.email || g.phone || 'no contact'})`);
    });
    console.log('');
  } catch (error) {
    console.error('   ❌ Failed:', error);
    await cleanup(context, prisma);
    process.exit(1);
  }

  // Test 5: Send invites via API
  console.log('🧪 Test 5: Sending invites via API...');
  console.log('   Creating admin session...');

  try {
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        user_id: context.userId!,
        user_role: 'admin',
        session_token: sessionToken,
        expires_at: expiresAt,
      },
    });

    context.sessionToken = sessionToken;

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

    console.log('   ⏳ Waiting for sends to process...');
    await sleep(3000);

    const sendLogs = await prisma.sendLog.findMany({
      where: { event_id: context.eventId! },
    });

    console.log(`   📊 Send logs created: ${sendLogs.length}`);
    sendLogs.forEach(log => {
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
    const guests = await prisma.guest.findMany({
      where: { event_id: context.eventId! },
      select: { name: true, invite_status: true, invite_token: true },
    });

    console.log('   Guest invite status:');
    guests.forEach(g => {
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

  // Auto-cleanup
  console.log('\n🧹 Auto-cleaning up test data...');
  await cleanup(context, prisma);
  await prisma.$disconnect();
  console.log('✅ Cleanup complete');
}

async function cleanup(context: TestContext, prisma: PrismaClient): Promise<void> {
  if (context.eventId) {
    await prisma.guest.deleteMany({ where: { event_id: context.eventId } });
    await prisma.rsvpField.deleteMany({ where: { event_id: context.eventId } });
    await prisma.eventAnnouncement.deleteMany({ where: { event_id: context.eventId } });
    await prisma.sendLog.deleteMany({ where: { event_id: context.eventId } });
    await prisma.event.deleteMany({ where: { id: context.eventId } });
  }

  if (context.userId) {
    await prisma.userSession.deleteMany({ where: { user_id: context.userId } });
    await prisma.adminUser.deleteMany({ where: { id: context.userId } });
  }
}

// Run tests
runIntegrationTests().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});

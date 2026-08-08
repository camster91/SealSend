import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function tableDefinition(schema, table) {
  return schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`))?.[0];
}

function assertColumns(schema, table, columns) {
  const definition = tableDefinition(schema, table);
  assert.ok(definition, `${table} table definition is missing`);
  for (const column of columns) {
    assert.match(definition, new RegExp(`\\b${column}\\s+`), `${table}.${column} is missing`);
  }
}

test('fresh database schema matches the send logging contract', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const table = schema.match(/CREATE TABLE IF NOT EXISTS send_logs \([\s\S]*?\n\);/)?.[0];

  assert.ok(table, 'send_logs table definition is missing');
  for (const column of [
    'send_type',
    'provider_message_id',
    'subject',
    'provider',
    'metadata',
    'updated_at',
  ]) {
    assert.match(table, new RegExp(`${column}\\s+`), `${column} is missing`);
  }
});

test('fresh and upgraded guest schemas support reminder tracking', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const guests = schema.match(/CREATE TABLE IF NOT EXISTS guests \([\s\S]*?\n\);/)?.[0];

  assert.ok(guests, 'guests table definition is missing');
  assert.match(guests, /reminder_sent_at\s+TIMESTAMPTZ/);
  assert.match(migration, /ALTER TABLE guests ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ/);
});

test('production migration backfills and constrains the send logging contract', async () => {
  const migration = await read('apply-security-indexes.sql');

  assert.match(migration, /UPDATE send_logs[\s\S]*send_type = channel/);
  assert.match(migration, /ALTER COLUMN send_type SET NOT NULL/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS send_logs_status_check/);
  assert.match(migration, /CHECK \(status IN \('pending', 'sent', 'failed', 'bounced', 'delivered'\)\)/);
});

test('feature table schemas match the SQL contracts used by application routes', async () => {
  const schema = await read('src/lib/db/schema.sql');

  assertColumns(schema, 'events', ['location_lat', 'location_lng', 'payment_id']);
  assertColumns(schema, 'guests', ['tags']);
  assert.match(tableDefinition(schema, 'guests'), /invite_status TEXT DEFAULT 'not_sent'/);
  assertColumns(schema, 'guest_tags', ['tag_name']);
  assertColumns(schema, 'rsvp_responses', ['submitted_at']);
  assertColumns(schema, 'event_comments', ['message']);
  assertColumns(schema, 'event_announcements', ['subject', 'sent_to_count']);
  assertColumns(schema, 'event_signup_items', ['category', 'slots']);
  assertColumns(schema, 'event_signup_claims', [
    'item_id',
    'event_id',
    'claimant_name',
    'claimant_email',
    'created_at',
  ]);
  assertColumns(schema, 'guest_magic_tokens', ['token_hash', 'token_preview', 'created_by']);
});

test('production container provisions a persistent writable uploads directory', async () => {
  const dockerfile = await read('Dockerfile');
  const compose = await read('docker-compose.yml');

  assert.match(dockerfile, /mkdir\s+-p\s+\/app\/uploads/);
  assert.match(dockerfile, /chown\s+nextjs:nodejs\s+\/app\/uploads/);
  assert.match(compose, /uploads_data:\/app\/uploads/);
  assert.match(compose, /^volumes:\s*\n\s+uploads_data:/m);
  assert.doesNotMatch(compose, /^version:/m);
  assert.doesNotMatch(dockerfile, /(?:ARG|ENV)\s+(?:MAILGUN_API_KEY|STRIPE_SECRET_KEY|TWILIO_AUTH_TOKEN|CRON_SECRET)/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/api\/health/);
  for (const key of [
    'DATABASE_URL',
    'STRIPE_SILVER_MONTHLY_PRICE_ID',
    'STRIPE_SILVER_YEARLY_PRICE_ID',
    'STRIPE_GOLD_MONTHLY_PRICE_ID',
    'STRIPE_GOLD_YEARLY_PRICE_ID',
  ]) {
    assert.match(compose, new RegExp(`- ${key}=\\$\\{${key}\\}`));
  }
});

test('health endpoint checks database readiness without exposing internals', async () => {
  const healthRoute = await read('src/app/api/health/route.ts');

  assert.match(healthRoute, /SELECT 1/);
  assert.match(healthRoute, /status:\s*503/);
  assert.match(healthRoute, /['"]Cache-Control['"]:\s*['"]no-store/);
  assert.doesNotMatch(healthRoute, /error\.message|String\(error\)/);
});

test('repository has one canonical Docker Compose definition', async () => {
  await assert.rejects(read('docker-compose.yaml'), { code: 'ENOENT' });
});

test('CI runs automatically and failures are blocking', async () => {
  const ci = await read('.github/workflows/ci.yml');

  assert.match(ci, /pull_request:/);
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
  assert.match(ci, /npm audit --omit=dev --audit-level=high/);
});

test('package exposes unit, typecheck, and e2e test commands', async () => {
  const pkg = JSON.parse(await read('package.json'));

  assert.equal(typeof pkg.scripts.test, 'string');
  assert.equal(typeof pkg.scripts.typecheck, 'string');
  assert.equal(typeof pkg.scripts['test:e2e'], 'string');
});

test('Next.js uses the repository as its build root and the current proxy convention', async () => {
  const config = await read('next.config.ts');
  const proxy = await read('src/proxy.ts');

  assert.match(config, /turbopack:\s*\{[\s\S]*?root:\s*process\.cwd\(\)/);
  assert.match(proxy, /export async function proxy\(/);
});

test('database rate limiting serializes attempts for the same key', async () => {
  const source = await read('src/lib/rate-limit.ts');

  assert.match(source, /await client\.query\(['"]BEGIN['"]\)/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /await client\.query\(['"]COMMIT['"]\)/);
  assert.match(source, /await client\.query\(['"]ROLLBACK['"]\)/);
});

test('paid checkout documents every Stripe price ID consumed by the app', async () => {
  const envExample = await read('.env.example');
  const checkout = await read('src/app/api/subscriptions/checkout/route.ts');

  assert.match(envExample, /^STRIPE_PRO_YEARLY_PRICE_ID=/m);
  assert.match(checkout, /process\.env\.STRIPE_PRO_YEARLY_PRICE_ID/);
  assert.doesNotMatch(envExample, /STRIPE_(SILVER|GOLD)_(MONTHLY|YEARLY)_PRICE_ID/);
});

test('annual Pro is accepted by fresh and upgraded subscription schemas', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const webhook = await read('src/app/api/webhooks/stripe/route.ts');

  assert.match(tableDefinition(schema, 'user_subscriptions'), /'pro_annual'/);
  assert.match(migration, /user_subscriptions_tier_check[\s\S]*'pro_annual'/);
  assert.match(webhook, /session\.payment_status/);
});

test('public capacity writes are serialized and RSVP plus-ones are atomic', async () => {
  const rsvp = await read('src/app/api/rsvp/[slug]/route.ts');
  const signups = await read('src/app/api/signups/[slug]/route.ts');

  assert.match(rsvp, /pg_advisory_xact_lock/);
  assert.match(rsvp, /BEGIN[\s\S]*INSERT INTO rsvp_responses[\s\S]*INSERT INTO plus_ones[\s\S]*COMMIT/);
  assert.doesNotMatch(rsvp, /Don't fail the RSVP if plus_ones creation fails/);
  assert.match(signups, /SELECT id, slots[\s\S]*FOR UPDATE/);
  assert.match(signups, /BEGIN[\s\S]*INSERT INTO event_signup_claims[\s\S]*COMMIT/);
});

test('event instants preserve the host timezone across browser, database, and invitations', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const wizard = await read('src/components/events/wizard/WizardContainer.tsx');
  const invitation = await read('src/lib/email-templates.ts');

  assert.match(tableDefinition(schema, 'events'), /event_timezone TEXT NOT NULL DEFAULT 'UTC'/);
  assert.match(migration, /events ADD COLUMN IF NOT EXISTS event_timezone/);
  assert.match(wizard, /new Date\(formData\.event_date\)\.toISOString\(\)/);
  assert.match(invitation, /formatDateTime\(eventDate, eventTimezone\)/);
});

test('deployment and config tooling use the active Mailgun email provider only', async () => {
  const compose = await read('docker-compose.yml');
  const configCheck = await read('scripts/test/check-config.ts');
  const pkg = JSON.parse(await read('package.json'));

  assert.doesNotMatch(compose, /RESEND_API_KEY/);
  assert.doesNotMatch(configCheck, /RESEND_API_KEY|Email \(Resend\)/);
  assert.match(configCheck, /MAILGUN_API_KEY/);
  assert.equal(pkg.dependencies.resend, undefined);
});

test('public marketing does not ship invented social proof', async () => {
  const marketingPage = await read('src/app/(marketing)/page.tsx');
  const useCasePage = await read('src/app/(marketing)/use-cases/[useCase]/page.tsx');
  const hero = await read('src/components/marketing/Hero.tsx');
  const pricingCta = await read('src/components/pricing/PricingCTA.tsx');
  const cta = await read('src/components/marketing/CTASection.tsx');

  assert.doesNotMatch(marketingPage, /<Testimonials\s*\/>/);
  assert.doesNotMatch(useCasePage, /<UseCaseTestimonial\b/);
  for (const source of [hero, pricingCta, cta]) {
    assert.doesNotMatch(source, /\d[\d,.]*\+|thousands of|4\.9\/5|99%/i);
  }
});

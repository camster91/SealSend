import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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
  const migration = await read('apply-security-indexes.sql');
  const verification = await read('scripts/test/verify-feature-schema.sql');

  assertColumns(schema, 'events', ['location_lat', 'location_lng', 'payment_id', 'event_brief', 'repeated_from_event_id']);
  assert.match(tableDefinition(schema, 'events'), /repeated_from_event_id\s+UUID\s+REFERENCES events\(id\) ON DELETE SET NULL/);
  assert.match(migration, /ALTER TABLE events ADD COLUMN IF NOT EXISTS repeated_from_event_id UUID REFERENCES events\(id\) ON DELETE SET NULL/);
  assert.match(verification, /repeated_from_event_id/);
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

test('browser QA covers five engines and the hero is hydration-safe with reduced motion', async () => {
  const config = await read('playwright.config.ts');
  assert.match(config, /Desktop Chrome/);
  assert.match(config, /Pixel 7/);
  assert.match(config, /Desktop Firefox/);
  assert.match(config, /Desktop Safari/);
  assert.match(config, /iPhone 15/);
  const hero = await read('src/components/marketing/Hero.tsx');
  assert.match(hero, /initial=\{false\}/);
  assert.doesNotMatch(hero, /useReducedMotion/);
  assert.doesNotMatch(hero, /repeat:\s*Infinity/);
});

test('recurring-organizer marketing describes the explicit next-event workflow', async () => {
  const useCases = await read('src/lib/use-case-content.ts');
  const constants = await read('src/lib/constants.ts');

  assert.doesNotMatch(useCases, /\bclone(?:d|s)?\b/i);
  assert.doesNotMatch(constants, /\bclone(?:d|s)?\b/i);
  assert.match(useCases, /Next-event setup/);
  assert.match(constants, /Next-event setup/);
  assert.match(useCases, /choose a new schedule/i);
  assert.match(useCases, /guest contact details/i);
  assert.match(useCases, /explicitly decide/i);
});

test('Next.js uses the repository as its build root and the current proxy convention', async () => {
  const config = await read('next.config.ts');
  const proxy = await read('src/proxy.ts');
  const openGraphImage = await read('src/app/opengraph-image.tsx');

  assert.match(config, /turbopack:\s*\{[\s\S]*?root:\s*process\.cwd\(\)/);
  assert.match(config, /NEXT_PUBLIC_SITE_URL\?\.startsWith\('https:\/\/'\)/);
  assert.match(proxy, /export async function proxy\(/);
  assert.doesNotMatch(openGraphImage, /runtime\s*=\s*["']edge["']/);
});

test('browser CI serves the same standalone artifact shape as production', async () => {
  const config = await read('playwright.config.ts');
  const pkg = JSON.parse(await read('package.json'));
  const server = await read('scripts/test/start-playwright-server.mjs');

  assert.match(config, /npm run build && npm run start:e2e/);
  assert.equal(pkg.scripts['start:e2e'], 'node scripts/test/start-playwright-server.mjs');
  assert.match(server, /\.next[\\/]standalone[\\/]server\.js/);
  assert.match(server, /\.next[\\/]static/);
  assert.match(server, /standalone[\\/]\.next[\\/]static/);
  assert.match(server, /standalone[\\/]public/);
});

test('public browser QA remains runnable without authenticated QA credentials', async () => {
  const browserSpec = await read('tests/e2e/live-full.spec.ts');
  const authenticatedTest = browserSpec.indexOf("test('authenticated host and guest lifecycle'");
  const nextPublicTest = browserSpec.indexOf("test('public navigation and responsive layouts'", authenticatedTest);
  const authenticatedBody = browserSpec.slice(authenticatedTest, nextPublicTest);

  assert.ok(authenticatedTest >= 0, 'authenticated lifecycle test must exist');
  assert.ok(nextPublicTest > authenticatedTest, 'public lifecycle test must remain independently addressable');
  assert.match(
    authenticatedBody,
    /test\.skip\(!qaEmail \|\| !qaPassword \|\| !qaBetaInviteToken/,
    'credential guard must be scoped inside the authenticated lifecycle test',
  );
});

test('authenticated browser fixture can reset only the named isolated database', async () => {
  const fixture = await read('scripts/test/prepare-authenticated-e2e.ts');

  assert.match(fixture, /SEALSEND_E2E_FIXTURE_CONFIRM !== ["']isolated["']/);
  assert.match(fixture, /new URL\(databaseUrl\)\.pathname !== ["']\/sealsend_e2e["']/);
  assert.match(fixture, /DROP SCHEMA public CASCADE; CREATE SCHEMA public/);
  assert.doesNotMatch(fixture, /console\.log\([^\n]*(?:password|inviteToken|email)/i);
});

test('every publication boundary enforces the shared guest-ready contract', async () => {
  const createRoute = await read('src/app/api/events/route.ts');
  const updateRoute = await read('src/app/api/events/[eventId]/route.ts');
  const publishRoute = await read('src/app/api/events/[eventId]/publish/route.ts');
  const preview = await read('src/components/events/wizard/StepPreview.tsx');
  const eventPage = await read('src/app/(dashboard)/events/[eventId]/page.tsx');
  const publishControl = await read('src/components/dashboard/PublishEventButton.tsx');

  for (const source of [createRoute, updateRoute, publishRoute, preview]) {
    assert.match(source, /getPublicationReadiness/);
  }
  assert.match(createRoute, /status\s*===\s*['"]published['"]/);
  assert.match(updateRoute, /targetStatus\s*=\s*parsed\.data\.status\s*\?\?\s*existing\.status/);
  assert.match(updateRoute, /targetStatus\s*===\s*['"]published['"]/);
  assert.match(updateRoute, /existing\.status\s*===\s*['"]archived['"][\s\S]*targetStatus\s*!==\s*['"]archived['"]/);
  assert.match(publishRoute, /readiness\.ready/);
  assert.match(publishRoute, /event\.status\s*===\s*['"]archived['"]/);
  assert.match(preview, /Complete before publishing/);
  assert.doesNotMatch(eventPage, /UPDATE events SET status/);
  assert.match(eventPage, /PublishEventButton/);
  assert.match(publishControl, /\/api\/events\/\$\{eventId\}\/publish/);
  assert.match(publishControl, /blockers/);
  assert.match(publishControl, /Review event details/);
  assert.match(publishControl, /role=["']alert["']/);
});

test('manual event creation exposes every required publication decision', async () => {
  const details = await read('src/components/events/wizard/StepEventDetails.tsx');
  const wizard = await read('src/components/events/wizard/WizardContainer.tsx');

  assert.match(details, /id=["']invitation_headline["']/);
  assert.match(details, /register\(['"]invitation_headline['"]/);
  assert.match(details, /id=["']invitation_body["']/);
  assert.match(details, /register\(['"]invitation_body['"]/);
  assert.match(wizard, /invitation_headline:\s*formData\.invitation_headline/);
  assert.match(wizard, /invitation_body:\s*formData\.invitation_body/);
  assert.match(details, /register\(['"]audience['"]/);
  assert.match(details, /register\(['"]accessibility_status['"]/);
  assert.match(details, /register\(['"]communication_preference['"]/);
  assert.match(wizard, /event_brief:\s*formData\.event_brief/);
  assert.equal((details.match(/id=["']title-counter["']/g) ?? []).length, 1);
  assert.equal((details.match(/id=["']description-counter["']/g) ?? []).length, 1);
});

test('structured event brief survives generation, storage, editing, and publication checks', async () => {
  const migration = await read('apply-security-indexes.sql');
  const validation = await read('src/lib/validations.ts');
  const createRoute = await read('src/app/api/events/route.ts');
  const updateRoute = await read('src/app/api/events/[eventId]/route.ts');
  const publishRoute = await read('src/app/api/events/[eventId]/publish/route.ts');
  const aiRoute = await read('src/app/api/ai/event-draft/route.ts');
  const generator = await read('src/components/events/wizard/PromptToEventGenerator.tsx');
  const details = await read('src/components/events/wizard/StepEventDetails.tsx');
  const preview = await read('src/components/events/wizard/StepPreview.tsx');

  assert.match(migration, /events ADD COLUMN IF NOT EXISTS event_brief JSONB/);
  assert.match(validation, /event_brief:\s*eventBriefContextSchema/);
  assert.match(createRoute, /event_brief/);
  assert.match(updateRoute, /event_brief/);
  assert.match(publishRoute, /event_brief/);
  assert.match(aiRoute, /brief:\s*eventBriefSchema/);
  assert.match(generator, /brief:\s*EventBrief/);
  assert.match(details, /values:\s*data/);
  assert.match(preview, /event_brief:\s*formData\.event_brief/);
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
  assert.match(wizard, /zonedLocalDateTimeToInstant\(formData\.event_date, formData\.event_timezone\)/);
  assert.doesNotMatch(wizard, /new Date\(formData\.event_date\)\.toISOString\(\)/);
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
  const openGraphImage = await read('src/app/opengraph-image.tsx');
  const marketingDirectory = new URL('../src/components/marketing/', import.meta.url);
  const marketingComponents = await Promise.all(
    (await readdir(marketingDirectory))
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => read(`src/components/marketing/${file}`)),
  );

  assert.doesNotMatch(marketingPage, /<Testimonials\s*\/>/);
  assert.doesNotMatch(useCasePage, /<UseCaseTestimonial\b/);
  for (const source of [hero, pricingCta, cta]) {
    assert.doesNotMatch(source, /\d[\d,.]*\+|thousands of|4\.9\/5|99%/i);
  }
  for (const source of marketingComponents) {
    assert.doesNotMatch(source, /10,000\+|200,000\+|500K\+|4\.9\/5|99% satisfaction/i);
    assert.doesNotMatch(source, /Sarah Mitchell|David Chen|Emily Rodriguez/);
  }
  assert.doesNotMatch(openGraphImage, /10,000\+|200,000\+|500K\+|4\.9\/5|99%/i);
  assert.match(openGraphImage, /Controlled Beta/);
  assert.match(openGraphImage, /One Event · Up to 100 Guests/);
});

test('public offer is a bounded controlled beta for recurring community organizers', async () => {
  const constants = await read('src/lib/constants.ts');
  const hero = await read('src/components/marketing/Hero.tsx');
  const howItWorks = await read('src/components/marketing/HowItWorks.tsx');
  const pricingCards = await read('src/components/pricing/PricingCards.tsx');
  const pricingFaq = await read('src/components/pricing/PricingFAQ.tsx');

  assert.match(constants, /export const BETA_MODE = true/);
  assert.match(constants, /CONTROLLED_BETA_PRICING_PLAN[\s\S]*guests:\s*"100"/);
  assert.match(hero, /recurring community organizers/i);
  assert.match(hero, /approved guest workflow/i);
  for (const stage of [
    'Start from the event brief',
    'Review the invitation and RSVP',
    'Act on the guest list',
    'Run event day',
  ]) {
    assert.match(howItWorks, new RegExp(stage, 'i'));
  }
  assert.match(pricingCards, /BETA_MODE\s*\?\s*\[CONTROLLED_BETA_PRICING_PLAN\]/);
  assert.match(pricingFaq, /one active event for up to 100 guests/i);
  assert.match(pricingFaq, /paid checkout is disabled/i);
});

test('public feature marketing stays inside the shipped approval-controlled workflow', async () => {
  const constants = await read('src/lib/constants.ts');
  const features = await read('src/components/marketing/FeaturesGrid.tsx');
  const metadata = await read('src/lib/metadata.ts');

  for (const staleClaim of [
    'opens in real-time',
    'Magical Experience',
    'social media',
    'instantly',
    'Registry Integration',
    'And much more',
    'Try it free',
  ]) {
    assert.doesNotMatch(`${constants}\n${features}`, new RegExp(staleClaim, 'i'));
  }

  for (const shippedCapability of [
    'Invitation studio',
    'Host-approved communications',
    'RSVP operations',
    'Actionable guest list',
    'Published guest experience',
    'Calendar and QR access',
    'Co-hosts and check-in',
    'Next-event workflow',
  ]) {
    assert.match(constants, new RegExp(shippedCapability, 'i'));
  }
  assert.match(constants, /resolved audience/i);
  assert.match(constants, /required new schedule/i);
  assert.match(constants, /guest contact reuse/i);
  assert.match(features, /Join controlled beta/);
  assert.match(metadata, /approved guest workflow/i);
  assert.match(metadata, /recurring community organizers/i);
});

test('controlled beta remains free and enforces one active event throughout the authenticated app', async () => {
  const dashboard = await read('src/app/(dashboard)/dashboard/page.tsx');
  const checkout = await read('src/app/api/subscriptions/checkout/route.ts');
  const events = await read('src/app/api/events/route.ts');

  assert.match(dashboard, /BETA_MODE/);
  assert.match(dashboard, /!BETA_MODE\s*&&\s*plan/);
  assert.match(dashboard, /accountPlan\s*===\s*['"]beta['"]\s*\?\s*100/);
  assert.match(checkout, /if\s*\(BETA_MODE\)/);
  assert.match(checkout, /controlled beta/i);
  assert.match(events, /status\s*<>\s*['"]archived['"]/i);
  assert.match(events, /one active event/i);
  assert.match(events, /pg_advisory_xact_lock/);
  assert.match(events, /BEGIN/);
  assert.match(events, /COMMIT/);
  assert.match(events, /ROLLBACK/);
  assert.match(events, /SAVEPOINT event_slug_attempt/);
});

test('dashboard reports truthful per-event guest usage', async () => {
  const dashboard = await read('src/app/(dashboard)/dashboard/page.tsx');
  const usage = await read('src/components/dashboard/UsageStats.tsx');

  assert.match(dashboard, /MAX\(event_guest_count\)/);
  assert.match(dashboard, /events\.status\s*<>\s*['"]archived['"]/i);
  assert.match(dashboard, /guestsUsed=\{Number\(guestUsage\?\.largest_event_guest_count\s*\?\?\s*0\)\}/);
  assert.doesNotMatch(dashboard, /guestsUsed=\{0\}/);
  assert.match(usage, /Guests in largest event/);
});

test('repeat organizers get an explicit, atomic, privacy-limited next-event workflow', async () => {
  const route = await read('src/app/api/events/[eventId]/clone/route.ts');
  const control = await read('src/components/dashboard/CloneEventButton.tsx');
  const eventRoute = await read('src/app/api/events/[eventId]/route.ts');

  assert.match(route, /parseRepeatEventRequest/);
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /status\s*<>\s*['"]archived['"]/i);
  assert.match(route, /canCreateEvent/);
  assert.match(route, /archiveSource/);
  assert.match(route, /UPDATE events SET status = ['"]archived['"]/i);
  assert.match(route, /requiresArchive/);
  assert.match(route, /BEGIN/);
  assert.match(route, /COMMIT/);
  assert.match(route, /ROLLBACK/);
  assert.match(route, /includeGuests/);
  assert.match(route, /buildRepeatedEventBrief/);
  assert.match(route, /event_brief/);
  assert.match(route, /repeated_from_event_id/);
  assert.match(route, /guest_tags/);
  assert.match(route, /guest_tag_assignments/);
  assert.doesNotMatch(route, /SELECT \* FROM events/);
  assert.doesNotMatch(route, /guest\.notes/);
  assert.match(eventRoute, /targetStatus === ['"]archived['"] && auth\.access\.role !== ['"]owner['"]/);
  assert.match(eventRoute, /Only the event owner can archive this event/);
  assert.match(eventRoute, /eventForAccess\(event, auth\.access\.role\)/);
  assert.match(eventRoute, /repeated_from_event_id:\s*_ownerOnlyLineage/);

  assert.match(control, /Repeat event/);
  assert.match(control, /type="datetime-local"/);
  assert.match(control, /includeGuests/);
  assert.match(control, /archiveSource/);
  assert.match(control, /Archive the current event/i);
  assert.match(control, /one-active-event/i);
  assert.match(control, /does not copy responses, check-ins, messages, or guest notes/i);
  assert.match(control, /audience carries forward/i);
  assert.match(control, /accessibility and communication decisions must be reviewed again/i);
  assert.match(control, /router\.push\(`\/events\/\$\{data\.event\.id\}\/edit`\)/);
  assert.match(control, /zonedLocalDateTimeToInstant/);
  assert.match(control, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(control, /titleInputRef\.current\?\.focus\(\)/);

  const eventPage = await read('src/app/(dashboard)/events/[eventId]/page.tsx');
  assert.match(eventPage, /const isArchived\s*=\s*event\.status\s*===\s*['"]archived['"]/);
  assert.match(eventPage, /!isArchived\s*&&\s*canEdit/);
  assert.match(eventPage, /Archived/);
  assert.match(eventPage, /repeated_from_title/);
  assert.match(eventPage, /Previous event/);
});

test('root discovery metadata matches the recurring-organizer controlled beta', async () => {
  const layout = await read('src/app/layout.tsx');
  const manifest = await read('public/manifest.json');
  const icon = await read('public/icons/icon.svg');

  for (const source of [layout, manifest]) {
    assert.match(source, /recurring (community )?organizers/i);
    assert.match(source, /approved guest workflow/i);
    assert.doesNotMatch(source, /wedding invitations|party invitations|beautiful digital invitations/i);
  }
  assert.match(layout, /manifest:\s*["']\/manifest\.json["']/);
  assert.doesNotMatch(layout, /\/og-image\.jpg/);
  assert.match(layout, /\/opengraph-image/);
  assert.match(manifest, /\/icons\/icon\.svg/);
  assert.match(icon, /<svg/);
});

test('every sitemap marketing page declares a canonical URL', async () => {
  const pages = [
    ['src/app/(marketing)/page.tsx', '/'],
    ['src/app/(marketing)/pricing/page.tsx', '/pricing'],
    ['src/app/(marketing)/terms/page.tsx', '/terms'],
    ['src/app/(marketing)/privacy/page.tsx', '/privacy'],
  ];
  for (const [file, route] of pages) {
    const source = await read(file);
    assert.match(source, new RegExp(`canonical:\\s*["']${route.replace('/', '\\/')}["']`), `${route} must declare its canonical URL`);
  }
});

test('candidate publishes factual support expectations without promising round-the-clock service', async () => {
  const support = await read('src/app/(marketing)/support/page.tsx');
  const footer = await read('src/components/layout/Footer.tsx');
  const sitemap = await read('src/app/sitemap.ts');
  assert.match(support, /within two business days/i);
  assert.match(support, /not a 24\/7 or guaranteed resolution time/i);
  assert.match(support, /Never email passwords, one-time codes, session cookies, payment-card data/i);
  assert.match(support, /controlled beta/i);
  assert.match(footer, /href="\/support"/);
  assert.match(sitemap, /`\$\{SITE_URL\}\/support`/);
});

test('the optional service worker never caches authenticated or API responses', async () => {
  const worker = await read('public/sw.js');
  assert.doesNotMatch(worker, /PRECACHE_URLS\s*=\s*\[[^\]]*['"]\/dashboard['"]/);
  assert.match(worker, /pathname\.startsWith\(['"]\/api\/['"]\)/);
  assert.match(worker, /pathname\.startsWith\(['"]\/dashboard['"]\)/);
  assert.match(worker, /cache-control/i);
  assert.match(worker, /no-store/i);
});

test('organizer use cases and comparison stay inside the shipped product scope', async () => {
  const content = await read('src/lib/use-case-content.ts');
  const indexPage = await read('src/app/(marketing)/use-cases/page.tsx');
  const detailPage = await read('src/app/(marketing)/use-cases/[useCase]/page.tsx');
  const navbar = await read('src/components/layout/Navbar.tsx');
  const footer = await read('src/components/layout/Footer.tsx');
  const sitemap = await read('src/app/sitemap.ts');
  const home = await read('src/app/(marketing)/page.tsx');
  const organizerFit = await read('src/components/marketing/OrganizerFit.tsx');

  for (const slug of [
    'community-events',
    'nonprofit-events',
    'clubs-associations',
    'professional-gatherings',
  ]) {
    assert.match(content, new RegExp(`slug: ["']${slug}["']`));
    for (const navigationSource of [navbar, footer, sitemap]) {
      assert.match(navigationSource, new RegExp(`/use-cases/${slug}`));
    }
  }
  assert.match(sitemap, /`\$\{SITE_URL\}\/use-cases`/);

  assert.match(indexPage, /USE_CASES/);
  assert.doesNotMatch(indexPage, /const useCases =/);
  assert.match(detailPage, /one active event with up to 100 guests/i);
  assert.match(content, /LEGACY_USE_CASE_REDIRECTS/);
  assert.match(detailPage, /redirect\(`\/use-cases\/\$\{canonicalUseCase\}`\)/);
  assert.doesNotMatch(content, /testimonial\s*:|Twyla Tyler|Monica W|Ashley Corbett|Brian Stuart/);
  assert.doesNotMatch(content, /music\s*(?:&|and)\s*video|photo sharing|gift tracking|1,200 replies/i);

  assert.match(home, /<OrganizerFit\s*\/>/);
  for (const alternative of [
    'Spreadsheets and group chats',
    'Invitation-first tools',
    'Enterprise event platforms',
  ]) {
    assert.match(organizerFit, new RegExp(alternative, 'i'));
  }
  assert.match(organizerFit, /product-scope comparison/i);
  assert.match(organizerFit, /not a claim about every competitor/i);
});

test('activation analytics has a privacy-limited fresh schema and upgrade path', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');

  const activationTable = tableDefinition(schema, 'activation_events');
  assert.match(activationTable, /event_name TEXT NOT NULL/);
  assert.match(activationTable, /metadata JSONB NOT NULL DEFAULT '\{\}'/);
  assert.doesNotMatch(activationTable, /email|phone|message|recipient/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS activation_events/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_user/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_event/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_user/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_event/);
});

test('the core activation funnel is recorded at successful lifecycle boundaries', async () => {
  const verifyCodeRoute = await read('src/app/api/auth/verify-code/route.ts');
  const eventsRoute = await read('src/app/api/events/route.ts');
  const publishRoute = await read('src/app/api/events/[eventId]/publish/route.ts');
  const guestsRoute = await read('src/app/api/events/[eventId]/guests/route.ts');
  const invitesRoute = await read('src/app/api/events/[eventId]/send-invites/route.ts');
  const rsvpRoute = await read('src/app/api/rsvp/[slug]/route.ts');

  assert.match(verifyCodeRoute, /created\?\.id[\s\S]*account_created/);
  assert.doesNotMatch(verifyCodeRoute, /if \(existing\)[^{]*\{?[^}]*account_created/);
  assert.match(eventsRoute, /recordActivationEventSafely[\s\S]*event_draft_started/);
  assert.match(publishRoute, /newStatus === ['"]published['"][\s\S]*event_published/);
  assert.match(guestsRoute, /recordActivationEventSafely[\s\S]*first_guest_added/);
  assert.match(invitesRoute, /successIds\.length > 0[\s\S]*first_invitation_sent/);
  assert.match(rsvpRoute, /COMMIT[\s\S]*first_rsvp_received/);
});

test('operations scripts schedule authenticated maintenance without exposing secrets', async () => {
  const cron = await read('ops/run-maintenance.sh');
  const cronDefinition = await read('ops/sealsend-maintenance.cron');

  assert.match(cron, /coolify\.resourceName=seal-send/);
  assert.match(cron, /Authorization: Bearer \$CRON_SECRET/);
  assert.match(cron, /api\/cron\/send-reminders/);
  assert.match(cron, /api\/cron\/cleanup-drafts/);
  assert.doesNotMatch(cron, /echo.*CRON_SECRET|set -x/);
  assert.match(cronDefinition, /run-maintenance\.sh reminders/);
  assert.match(cronDefinition, /run-maintenance\.sh cleanup/);
});

test('load and recovery gates are bounded, read-only, and isolated from production data', async () => {
  const load = await read('scripts/load/public-readiness.mjs');
  const capacity = await read('scripts/load/rsvp-capacity.mjs');
  const recovery = await read('ops/rehearse-release.sh');
  assert.match(load, /requestCount > 5000/);
  assert.match(load, /concurrency > 50/);
  assert.match(load, /method|fetch/);
  assert.doesNotMatch(load, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
  assert.match(load, /failures: 0/);
  assert.match(load, /p95Ms/);
  assert.match(capacity, /ALLOW_MUTATING_LOAD_TEST/);
  assert.match(capacity, /ALLOW_PRODUCTION_MUTATING_LOAD_TEST/);
  assert.match(capacity, /qa-capacity-/);
  assert.match(capacity, /attempts > 25/);
  assert.match(recovery, /sealsend-rehearsal-/);
  assert.match(recovery, /postgres:16-alpine/);
  assert.match(recovery, /PostgreSQL init process complete; ready for start up/);
  assert.match(recovery, /pg_restore --exit-on-error/);
  assert.match(recovery, /PAYMENTS_TEST_ONLY=true/);
  assert.match(recovery, /COMMUNICATIONS_TEST_ONLY=true/);
  assert.doesNotMatch(recovery, /sealsend-postgres/);
});

test('database backup tooling uses container credentials, retention, and archive verification', async () => {
  const backup = await read('ops/backup-database.sh');

  assert.match(backup, /sealsend-postgres/);
  assert.match(backup, /pg_dump --format=custom/);
  assert.match(backup, /pg_restore --list/);
  assert.match(backup, /-mtime \+30 -delete/);
  assert.doesNotMatch(backup, /POSTGRES_PASSWORD|DATABASE_URL|set -x/);
});

test('calendar downloads expose only published events with safe response headers', async () => {
  const route = await read('src/app/api/calendar/[slug]/route.ts');
  const component = await read('src/components/public-event/AddToCalendar.tsx');

  assert.match(route, /status = ['"]published['"]/);
  assert.match(route, /buildIcsCalendar/);
  assert.match(route, /text\/calendar/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /Cache-Control/);
  assert.match(component, /buildCalendarLinks/);
  assert.doesNotMatch(component, /URL\.createObjectURL|function downloadICS/);
});

test('co-hosting schemas enforce roles, uniqueness, hashed invitations, and auditability', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');

  const members = tableDefinition(schema, 'event_members');
  const invites = tableDefinition(schema, 'event_member_invites');
  const audit = tableDefinition(schema, 'event_audit_log');

  assert.match(members, /UNIQUE\s*\(event_id, user_id\)/);
  assert.match(members, /'manager'[\s\S]*'check_in'[\s\S]*'viewer'/);
  assert.match(invites, /token_hash TEXT UNIQUE NOT NULL/);
  assert.match(invites, /expires_at TIMESTAMPTZ NOT NULL/);
  assert.doesNotMatch(invites, /token TEXT/);
  assert.match(audit, /actor_user_id UUID/);
  assert.match(audit, /action TEXT NOT NULL/);
  for (const table of ['event_members', 'event_member_invites', 'event_audit_log']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test('co-host invitation APIs are owner-gated, capacity-safe, and never persist raw tokens', async () => {
  const membersRoute = await read('src/app/api/events/[eventId]/members/route.ts');
  const memberRoute = await read('src/app/api/events/[eventId]/members/[memberId]/route.ts');
  const acceptRoute = await read('src/app/api/team-invites/[token]/accept/route.ts');

  assert.match(membersRoute, /roleCan\([^,]+, ['"]manage_members['"]\)/);
  assert.match(membersRoute, /FOR UPDATE/);
  assert.match(membersRoute, /getTeamMemberLimit/);
  assert.match(membersRoute, /hashMagicToken/);
  assert.match(membersRoute, /token_hash/);
  const inviteInsertColumns = membersRoute.match(
    /INSERT INTO event_member_invites\s*\(([^)]+)\)/,
  )?.[1];
  assert.ok(inviteInsertColumns, 'invite insert column list is present');
  assert.doesNotMatch(inviteInsertColumns, /(^|,)\s*token\s*(,|$)/);
  assert.match(memberRoute, /roleCan\([^,]+, ['"]manage_members['"]\)/);
  assert.match(acceptRoute, /hashMagicToken/);
  assert.match(acceptRoute, /LOWER\(i\.email\) = LOWER\(\$2\)/);
  assert.match(acceptRoute, /BEGIN[\s\S]*INSERT INTO event_members[\s\S]*accepted_at[\s\S]*COMMIT/);
});

test('mobile check-in is permission-gated, auditable, and reversible', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const route = await read('src/app/api/events/[eventId]/check-in/route.ts');
  const page = await read('src/app/(dashboard)/events/[eventId]/check-in/page.tsx');

  assert.match(schema, /checked_in_at TIMESTAMPTZ/);
  assert.match(schema, /checked_in_by UUID REFERENCES admin_users/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ/);
  assert.match(route, /roleCan\([^,]+, ['"]check_in_guests['"]\)/);
  assert.match(route, /UPDATE guests[\s\S]*checked_in_at[\s\S]*RETURNING/);
  assert.match(route, /guest_checked_(?:in|out)/);
  assert.match(page, /aria-label=.*Search guests/);
});

test('event-day check-in refreshes safely for reconnects and multiple staff', async () => {
  const page = await read('src/app/(dashboard)/events/[eventId]/check-in/page.tsx');
  const live = await read('tests/e2e/live-check-in-role.spec.ts');

  assert.match(page, /Refresh guest list/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /window\.addEventListener\(["']online["'][\s\S]*load/);
  assert.match(page, /setInterval\([\s\S]*15_000/);
  assert.match(page, /document\.visibilityState\s*===\s*["']visible["']/);
  assert.match(page, /aria-busy=\{refreshing\}/);
  assert.match(page, /Last confirmed/);
  assert.match(page, /Print loaded guest list/);
  assert.match(page, /window\.print\(\)/);
  assert.match(page, /hidden print:table/);
  assert.match(page, /manual check-in[\s\S]*reconcile after reconnecting/i);
  assert.match(live, /getByRole\(["']button["'],\s*\{\s*name:\s*["']Refresh guest list["']/);
  assert.match(live, /toContainText\(["']Check in["']\)/);
});

test('event owners can download a privacy-limited check-in fallback', async () => {
  const route = await read('src/app/api/events/[eventId]/guests/route.ts');
  const page = await read('src/app/(dashboard)/events/[eventId]/guests/page.tsx');
  const live = await read('tests/e2e/live-full.spec.ts');

  assert.match(route, /format\s*===\s*["']check-in-csv["']/);
  assert.match(route, /format\s*===\s*["']check-in-csv["']\s*\?\s*["']export_responses["']\s*:\s*["']view_guest_contacts["']/);
  assert.match(route, /SELECT name, rsvp_status, invite_status, checked_in_at/);
  assert.doesNotMatch(route, /SELECT name, rsvp_status, invite_status, checked_in_at[^;]*email/i);
  assert.match(route, /guest_check_in_fallback_exported/);
  assert.match(route, /Content-Disposition[\s\S]*check-in-fallback/);
  assert.match(route, /Cache-Control["']?:\s*["']no-store["']/);
  assert.match(route, /\^\[=\+\\-@\\t\\r\]/);
  assert.match(page, /Download check-in fallback/);
  assert.match(page, /format=check-in-csv/);
  assert.match(live, /format=check-in-csv/);
  assert.match(live, /not\.toContain\(['"]qa-guest-one@example\.com['"]\)/);
});

test('scheduled announcements are approved, cancellable, and idempotently dispatched', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const cron = await read('src/app/api/cron/send-announcements/route.ts');
  const route = await read('src/app/api/events/[eventId]/announcements/route.ts');
  const cancel = await read('src/app/api/events/[eventId]/announcements/[announcementId]/route.ts');

  assert.match(schema, /announcement_deliveries[\s\S]*UNIQUE \(announcement_id, guest_id, channel\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS announcement_deliveries/);
  assert.match(route, /approved[\s\S]*audience[\s\S]*scheduledAt/);
  assert.match(cancel, /status = 'cancelled'[\s\S]*status = 'queued'/);
  assert.match(cron, /Bearer \$\{cronSecret\}/);
  assert.match(cron, /dispatchAnnouncement/);
  assert.match(cron, /FOR UPDATE SKIP LOCKED/);
});

test('every event mutation is routed through the explicit role permission model', async () => {
  const mutationRoutes = [
    'src/app/api/events/[eventId]/route.ts',
    'src/app/api/events/[eventId]/publish/route.ts',
    'src/app/api/events/[eventId]/clone/route.ts',
    'src/app/api/events/[eventId]/rsvp-fields/route.ts',
    'src/app/api/events/[eventId]/guests/route.ts',
    'src/app/api/events/[eventId]/guests/bulk/route.ts',
    'src/app/api/events/[eventId]/guests/[guestId]/route.ts',
    'src/app/api/events/[eventId]/tags/route.ts',
    'src/app/api/events/[eventId]/signups/route.ts',
    'src/app/api/events/[eventId]/comments/route.ts',
    'src/app/api/events/[eventId]/responses/[responseId]/route.ts',
    'src/app/api/events/[eventId]/send-invites/route.ts',
    'src/app/api/events/[eventId]/send-reminders/route.ts',
    'src/app/api/events/[eventId]/announcements/route.ts',
    'src/app/api/events/[eventId]/announcements/draft/route.ts',
    'src/app/api/events/[eventId]/announcements/draft/[generationId]/route.ts',
    'src/app/api/events/[eventId]/check-in/route.ts',
    'src/app/api/events/[eventId]/members/route.ts',
    'src/app/api/events/[eventId]/members/[memberId]/route.ts',
  ];
  for (const routePath of mutationRoutes) {
    const source = await read(routePath);
    assert.match(source, /requireEventPermission|roleCan\(/, `${routePath} must enforce a named event permission`);
  }
});

test('beta operations include privacy-safe error capture and authenticated feedback', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const monitoring = await read('src/lib/monitoring/server-errors.ts');
  const instrumentation = await read('src/instrumentation.ts');
  const feedback = await read('src/app/api/feedback/route.ts');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS server_error_events/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS monitoring_alert_deliveries/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS beta_feedback/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS server_error_events/);
  assert.doesNotMatch(monitoring, /error\.message|error\.stack/);
  assert.match(monitoring, /last_delivered_at/);
  assert.match(monitoring, /response\.ok/);
  assert.match(instrumentation, /onRequestError/);
  assert.match(feedback, /requireApiHost/);
  assert.match(feedback, /rateLimit/);
});

test('controlled beta evidence requires explicit consent, supports withdrawal, and records real milestones', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const route = await read('src/app/api/beta/participation/route.ts');
  const panel = await read('src/components/dashboard/BetaParticipation.tsx');
  const settings = await read('src/app/(dashboard)/settings/page.tsx');
  const activation = await read('src/lib/analytics/activation-events.ts');
  const repeat = await read('src/app/api/events/[eventId]/clone/route.ts');
  const guestImport = await read('src/app/api/events/[eventId]/guests/bulk/route.ts');
  const announcement = await read('src/app/api/events/[eventId]/announcements/route.ts');
  const calendar = await read('src/app/api/calendar/[slug]/route.ts');
  const checkIn = await read('src/app/api/events/[eventId]/check-in/route.ts');
  const metrics = await read('src/app/api/operations/metrics/route.ts');
  const live = await read('tests/e2e/live-full.spec.ts');

  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS beta_participants/);
    assert.match(sql, /consent_version TEXT NOT NULL/);
    assert.match(sql, /consented_at TIMESTAMPTZ NOT NULL/);
    assert.match(sql, /withdrawn_at TIMESTAMPTZ/);
    for (const segment of ['club_association', 'volunteer_nonprofit', 'creative_community', 'alumni_professional', 'repeat_planner']) {
      assert.match(sql, new RegExp(`['"]${segment}['"]`));
    }
    for (const milestone of ['event_repeated', 'guest_import_completed', 'announcement_approved', 'calendar_exported', 'first_guest_checked_in']) {
      assert.match(sql, new RegExp(`['"]${milestone}['"]`));
    }
  }
  assert.match(migration, /DROP CONSTRAINT IF EXISTS beta_participants_segment_check/);
  assert.match(migration, /withdrawn_at = COALESCE\(withdrawn_at, NOW\(\)\)/);
  assert.match(route, /requireApiHost/);
  assert.match(route, /parseBetaEnrollment/);
  assert.match(route, /deriveBetaProgress/);
  assert.match(route, /withdrawn_at = NOW\(\)/);
  assert.match(route, /Cache-Control["']?:\s*["']no-store["']/);
  assert.doesNotMatch(route, /SELECT \*/);
  assert.match(panel, /Join controlled beta/);
  assert.match(panel, /workflow milestones/);
  assert.match(panel, /does not record guest names, contact details, message bodies, or response content/);
  assert.match(panel, /Withdraw beta consent/);
  assert.match(settings, /BetaParticipation/);
  for (const milestone of ['event_repeated', 'guest_import_completed', 'announcement_approved', 'calendar_exported', 'first_guest_checked_in']) {
    assert.match(activation, new RegExp(`["']${milestone}["']`));
  }
  assert.match(repeat, /name:\s*["']event_repeated["']/);
  assert.match(guestImport, /name:\s*["']guest_import_completed["']/);
  assert.match(announcement, /name:\s*["']announcement_approved["']/);
  assert.match(calendar, /name:\s*["']calendar_exported["']/);
  assert.match(checkIn, /name:\s*["']first_guest_checked_in["']/);
  assert.match(metrics, /betaParticipants/);
  assert.match(metrics, /computeBetaCohortMetrics/);
  assert.match(metrics, /betaCohort/);
  assert.match(metrics, /withdrawn_at IS NULL/);
  assert.doesNotMatch(metrics, /participant_label|respondent_name|respondent_email|message\s+FROM|recipient/);
  assert.match(live, /api\/beta\/participation/);
  assert.match(live, /completedRequired\)\.toBe\(9\)/);
  assert.match(live, /method:\s*['"]DELETE['"]/);
});

test('controlled beta enrollment accepts only operator invitations', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const route = await read('src/app/api/beta/participation/route.ts');
  const panel = await read('src/components/dashboard/BetaParticipation.tsx');
  const command = await read('scripts/create-beta-invite.ts');
  const pkg = JSON.parse(await read('package.json'));

  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS beta_enrollment_invites/);
    for (const column of ['token_hash', 'token_preview', 'participant_label', 'segment', 'expires_at', 'accepted_by', 'accepted_at', 'revoked_at']) {
      assert.match(sql, new RegExp(`${column}\\s`));
    }
  }
  assert.match(route, /hashMagicToken\(enrollment\.inviteToken\)/);
  assert.match(route, /BEGIN/);
  assert.match(route, /FOR UPDATE/);
  assert.match(route, /accepted_at IS NULL/);
  assert.match(route, /revoked_at IS NULL/);
  assert.match(route, /expires_at > NOW\(\)/);
  assert.match(route, /Enter a valid invitation code and explicitly consent/);
  assert.match(route, /accepted_by = \$2[\s\S]*accepted_at = NOW\(\)/);
  assert.match(route, /COMMIT/);
  assert.match(route, /ROLLBACK/);
  assert.doesNotMatch(route, /randomBytes/);
  assert.doesNotMatch(route, /enrollment\.segment/);
  assert.match(panel, /Invitation code/);
  assert.match(panel, /inviteToken/);
  assert.doesNotMatch(panel, /beta-segment/);
  assert.match(command, /generateMagicToken/);
  assert.match(command, /hashMagicToken/);
  assert.match(command, /previewMagicToken/);
  assert.match(command, /BETA_SEGMENTS/);
  assert.match(command, /INTERVAL '7 days'/);
  assert.equal(pkg.scripts['create-beta-invite'], 'npx tsx scripts/create-beta-invite.ts');
});

test('accepted beta invitations survive account deletion without retaining the account id', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');

  for (const sql of [schema, migration]) {
    const invites = tableDefinition(sql, 'beta_enrollment_invites');
    assert.match(invites, /accepted_by UUID REFERENCES admin_users\(id\) ON DELETE SET NULL/);
    assert.doesNotMatch(invites, /accepted_at IS NULL OR accepted_by IS NOT NULL/);
  }
});

test('operators can inspect and revoke beta invitations without exposing raw codes', async () => {
  const listCommand = await read('scripts/list-beta-invites.ts');
  const revokeCommand = await read('scripts/revoke-beta-invite.ts');
  const pkg = JSON.parse(await read('package.json'));

  assert.match(listCommand, /participant_label/);
  assert.match(listCommand, /token_preview/);
  assert.match(listCommand, /classifyBetaInvite/);
  assert.doesNotMatch(listCommand, /token_hash/);
  assert.doesNotMatch(listCommand, /Invitation code/);

  assert.match(revokeCommand, /parseBetaInviteLabel/);
  assert.match(revokeCommand, /accepted_at IS NULL/);
  assert.match(revokeCommand, /revoked_at IS NULL/);
  assert.match(revokeCommand, /SET revoked_at = NOW\(\)/);
  assert.doesNotMatch(revokeCommand, /token_hash/);

  assert.equal(pkg.scripts['list-beta-invites'], 'npx tsx scripts/list-beta-invites.ts');
  assert.equal(pkg.scripts['revoke-beta-invite'], 'npx tsx scripts/revoke-beta-invite.ts');
});

test('operators can export a pseudonymous five-host acceptance report without personal data', async () => {
  const command = await read('scripts/report-beta-participants.ts');
  const pkg = JSON.parse(await read('package.json'));

  assert.match(command, /participant_label/);
  assert.match(command, /consent_version/);
  assert.match(command, /buildBetaParticipantReport/);
  assert.match(command, /activation_events/);
  assert.match(command, /beta_feedback/);
  assert.match(command, /beta_outcomes/);
  for (const prohibited of ['token_hash', 'token_preview', 'admin_users', 'feedback.message', 'guests']) {
    assert.doesNotMatch(command, new RegExp(prohibited.replace('.', '\\.')));
  }
  assert.equal(pkg.scripts['report-beta-participants'], 'npx tsx scripts/report-beta-participants.ts');
});

test('structured beta outcomes are consent-scoped, price-versioned, and evidence-limited', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const route = await read('src/app/api/beta/outcome/route.ts');
  const panel = await read('src/components/dashboard/BetaOutcomeSurvey.tsx');
  const participation = await read('src/components/dashboard/BetaParticipation.tsx');
  const register = await read('docs/paid-beta-evidence-register.md');

  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS beta_outcomes/);
    assert.match(sql, /UNIQUE \(user_id, consented_at\)/);
    assert.match(sql, /self_reported_support_minutes INTEGER NOT NULL CHECK \(self_reported_support_minutes BETWEEN 0 AND 600\)/);
  }
  assert.match(route, /requireApiHost/);
  assert.match(route, /withdrawn_at IS NULL/);
  assert.match(route, /segment = ANY/);
  assert.match(route, /ON CONFLICT \(user_id, consented_at\)/);
  assert.doesNotMatch(route, /request.*consent|request.*segment|request.*priceVersion/i);
  assert.match(panel, /\$124\.99\/year/);
  assert.match(panel, /\$8\.99-\$49\.99\/event/);
  assert.match(panel, /self-reported/i);
  assert.match(panel, /stated intent/i);
  assert.match(participation, /BetaOutcomeSurvey/);
  assert.match(register, /self-reported/i);
  assert.match(register, /stated intent/i);
  assert.match(register, /not paid conversion/i);
});

test('pending beta hosts never claim zero critical defects before human review', async () => {
  const register = await read('docs/paid-beta-evidence-register.md');
  const pendingHostRows = register.split(/\r?\n/).filter((line) => /^\| host-0[1-5] \|/.test(line));

  assert.equal(pendingHostRows.length, 5);
  for (const row of pendingHostRows) {
    assert.match(row, /\| Pending \|\s*$/);
    assert.doesNotMatch(row, /\| 0 \|\s*$/);
  }
});

test('operators can record explicit consent-window severity review without guest or defect text', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const command = await read('scripts/record-beta-defect-review.ts');
  const report = await read('scripts/report-beta-participants.ts');
  const metrics = await read('src/app/api/operations/metrics/route.ts');
  const register = await read('docs/paid-beta-evidence-register.md');
  const pkg = JSON.parse(await read('package.json'));

  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS beta_defect_reviews/);
    assert.match(sql, /UNIQUE \(user_id, consented_at\)/);
    assert.match(sql, /unresolved_severity_1 INTEGER NOT NULL CHECK \(unresolved_severity_1 BETWEEN 0 AND 100\)/);
    assert.match(sql, /unresolved_severity_2 INTEGER NOT NULL CHECK \(unresolved_severity_2 BETWEEN 0 AND 100\)/);
    assert.doesNotMatch(sql, /defect_(?:message|notes|description)/);
    assert.match(sql, /UNIQUE INDEX IF NOT EXISTS idx_beta_participants_user_consent/);
    assert.match(sql, /FOREIGN KEY \(user_id, consented_at\) REFERENCES beta_participants\(user_id, consented_at\) ON DELETE CASCADE/);
  }
  assert.match(command, /parseBetaDefectReview/);
  assert.match(command, /FOR UPDATE/);
  assert.match(command, /segment = ANY/);
  assert.match(command, /ON CONFLICT \(user_id, consented_at\)/);
  assert.match(command, /reviewer_name/);
  assert.doesNotMatch(command, /SELECT \*/);
  assert.match(report, /beta_defect_reviews/);
  assert.doesNotMatch(report, /reviewer_name/);
  assert.match(metrics, /beta_defect_reviews/);
  assert.doesNotMatch(metrics, /reviewer_name/);
  assert.match(register, /not reviewed/i);
  assert.match(register, /named human/i);
  assert.equal(pkg.scripts['record-beta-defect-review'], 'npx tsx scripts/record-beta-defect-review.ts');
});

test('operators can record consent-window support effort without conflating host self-report', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const command = await read('scripts/record-beta-support-review.ts');
  const report = await read('scripts/report-beta-participants.ts');
  const metrics = await read('src/app/api/operations/metrics/route.ts');
  const register = await read('docs/paid-beta-evidence-register.md');
  const pkg = JSON.parse(await read('package.json'));

  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS beta_support_reviews/);
    assert.match(sql, /UNIQUE \(user_id, consented_at\)/);
    assert.match(sql, /operator_recorded_support_minutes INTEGER NOT NULL CHECK \(operator_recorded_support_minutes BETWEEN 0 AND 600\)/);
    assert.doesNotMatch(sql, /support_(?:message|notes|description)/);
    assert.match(sql, /FOREIGN KEY \(user_id, consented_at\) REFERENCES beta_participants\(user_id, consented_at\) ON DELETE CASCADE/);
  }
  assert.match(command, /parseBetaSupportReview/);
  assert.match(command, /FOR UPDATE/);
  assert.match(command, /segment = ANY/);
  assert.match(command, /ON CONFLICT \(user_id, consented_at\)/);
  assert.match(command, /reviewer_name/);
  assert.doesNotMatch(command, /SELECT \*/);
  assert.match(report, /beta_support_reviews/);
  assert.doesNotMatch(report, /SELECT[\s\S]*reviewer_name/);
  assert.match(metrics, /beta_support_reviews/);
  assert.doesNotMatch(metrics, /reviewer_name/);
  assert.match(register, /operator-recorded/i);
  assert.match(register, /self-reported/i);
  assert.equal(pkg.scripts['record-beta-support-review'], 'npx tsx scripts/record-beta-support-review.ts');
});

test('beta acceptance is evaluated only against pre-approved, pre-cohort thresholds', async () => {
  const policy = JSON.parse(await read('config/beta-acceptance-policy.json'));
  const evaluator = await read('src/lib/beta-acceptance-decision.ts');
  const metrics = await read('src/app/api/operations/metrics/route.ts');
  const operations = await read('docs/launch-operations.md');

  assert.equal(policy.schemaVersion, 1);
  assert.match(policy.cohortVersion, /^[a-z0-9][a-z0-9-]{2,63}$/);
  assert.equal(policy.status, 'approved');
  assert.equal(policy.approvedBy, 'Cameron Ashley');
  assert.match(policy.approvedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(policy.thresholds.minimumCohortSize, 5);
  assert.match(evaluator, /approvedAt/);
  assert.match(evaluator, /cohortStartedAt/);
  assert.match(evaluator, /before the first host consent/i);
  assert.match(evaluator, /minimumWillingToPayHosts/);
  assert.match(evaluator, /maximumUnresolvedCriticalDefects/);
  assert.match(evaluator, /medianOperatorRecordedSupportMinutes/);
  assert.match(metrics, /evaluateBetaAcceptance/);
  assert.match(metrics, /betaAcceptance/);
  assert.match(operations, /must be approved before the first host consents/i);
  assert.match(operations, /must not be changed after beta evidence exists/i);
});

test('beta evidence is isolated to one approved cohort with one active host per segment', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const createInvite = await read('scripts/create-beta-invite.ts');
  const listInvites = await read('scripts/list-beta-invites.ts');
  const participation = await read('src/app/api/beta/participation/route.ts');
  const metrics = await read('src/app/api/operations/metrics/route.ts');
  const report = await read('scripts/report-beta-participants.ts');
  const featureSchemaVerification = await read('scripts/test/verify-feature-schema.sql');
  const operations = await read('docs/launch-operations.md');

  for (const sql of [schema, migration]) {
    assert.match(sql, /beta_enrollment_invites[\s\S]*cohort_version TEXT NOT NULL/);
    assert.match(sql, /beta_participants[\s\S]*cohort_version TEXT NOT NULL/);
    assert.match(sql, /UNIQUE INDEX IF NOT EXISTS idx_beta_participants_active_cohort_segment/);
    assert.match(sql, /ON beta_participants\(cohort_version, segment\)/);
    assert.match(sql, /WHERE withdrawn_at IS NULL AND cohort_version <> 'legacy-unassigned'/);
    assert.match(sql, /UNIQUE INDEX IF NOT EXISTS idx_beta_invites_open_cohort_segment/);
  }
  assert.match(createInvite, /betaAcceptancePolicy/);
  assert.match(createInvite, /status !== "approved"/);
  assert.match(createInvite, /cohort_version/);
  assert.match(listInvites, /cohort_version/);
  assert.match(participation, /betaAcceptancePolicy/);
  assert.match(participation, /cohort_version/);
  assert.match(participation, /status !== "approved"/);
  assert.match(metrics, /participants\.cohort_version = \$1/);
  assert.match(report, /participants\.cohort_version = \$1/);
  assert.match(
    featureSchemaVerification,
    /INSERT INTO beta_enrollment_invites\s*\(\s*token_hash,\s*token_preview,\s*participant_label,\s*segment,\s*cohort_version,\s*expires_at\s*\)/,
  );
  assert.match(operations, /one active host per required segment/i);
  assert.match(operations, /legacy-unassigned/i);
});

test('communication review exposes resolved recipients, cost status, controls, and a separate approval gate', async () => {
  const audience = await read('src/app/api/events/[eventId]/announcements/audience/route.ts');
  const draft = await read('src/app/api/events/[eventId]/announcements/draft/route.ts');
  const dispatch = await read('src/lib/messages/dispatch-announcement.ts');
  const approvalProof = await read('src/lib/messages/approval-proof.ts');
  const announcementRoute = await read('src/app/api/events/[eventId]/announcements/route.ts');
  const modal = await read('src/components/dashboard/SendAnnouncementModal.tsx');
  assert.match(audience, /recipients:/);
  assert.match(audience, /estimatedCostMicros/);
  assert.match(audience, /countSmsSegments/);
  assert.match(audience, /smsSegmentCount/);
  assert.match(audience, /subject: parsed\.data\.subject/);
  assert.match(audience, /message: parsed\.data\.message/);
  assert.match(dispatch, /message: announcement\.message/);
  assert.match(approvalProof, /createHmac/);
  assert.match(approvalProof, /timingSafeEqual/);
  assert.match(announcementRoute, /verifyAnnouncementApprovalProof/);
  assert.match(announcementRoute, /approval expired/);
  for (const control of ['tone', 'length', 'urgency', 'channel']) assert.match(draft, new RegExp(control));
  assert.match(modal, /Review resolved recipients/);
  assert.match(modal, /Estimated provider charge/);
  assert.match(modal, /billed SMS segment/);
  assert.match(modal, /subject: subject\.trim\(\), message: message\.trim\(\)/);
  assert.match(modal, /approvalProof: preview\?\.approvalProof/);
  assert.match(modal, /approve this external send/);
  assert.doesNotMatch(draft, /dispatchAnnouncement|sendEmail|\.messages\.create/);
});

test('RSVP intelligence is aggregate, traceable, and permission gated', async () => {
  const route = await read('src/app/api/events/[eventId]/responses/summary/route.ts');
  const summary = await read('src/lib/rsvp-summary.ts');
  assert.match(route, /requireEventPermission\(eventId, "export_responses"\)/);
  assert.match(summary, /sourceResponseCount/);
  assert.match(summary, /sourceResponseIds/);
  assert.doesNotMatch(summary, /fetch\(|openai|sendEmail/);
});

test('invitation studio has a launch-sized accessible catalog and non-destructive crop controls', async () => {
  const templates = await read('src/lib/event-templates.ts');
  const uploader = await read('src/components/events/wizard/StepDesignUpload.tsx');
  const page = await read('src/app/(dashboard)/events/new/page.tsx');
  const count = [...templates.matchAll(/\{ id: "/g)].length;
  assert.ok(count >= 12 && count <= 20, `expected 12-20 templates, found ${count}`);
  assert.match(uploader, /Artwork crop and focus/);
  assert.match(uploader, /keeps the uploaded original/);
  assert.match(page, /getEventTemplate/);
});

test('RSVP field options are valid JSON and replacement is transactional', async () => {
  const createRoute = await read('src/app/api/events/route.ts');
  const fieldsRoute = await read('src/app/api/events/[eventId]/rsvp-fields/route.ts');
  assert.match(createRoute, /field\.options \? JSON\.stringify\(field\.options\) : null/);
  assert.match(fieldsRoute, /await client\.query\('BEGIN'\)/);
  assert.match(fieldsRoute, /await client\.query\('DELETE FROM rsvp_fields/);
  assert.match(fieldsRoute, /f\.options \? JSON\.stringify\(f\.options\) : null/);
  assert.match(fieldsRoute, /await client\.query\('COMMIT'\)/);
  assert.match(fieldsRoute, /await client\.query\('ROLLBACK'\)/);
});

test('event checkout verifies ownership before exposing billing configuration', async () => {
  const route = await read('src/app/api/checkout/route.ts');
  const ownershipIndex = route.indexOf("SELECT id, title, tier FROM events WHERE id = $1 AND user_id = $2");
  const billingIndex = route.indexOf('if (!isStripeKeyAllowed())');
  assert.ok(ownershipIndex >= 0);
  assert.ok(billingIndex > ownershipIndex);
});

test('check-in actor IDs are explicitly typed for PostgreSQL CASE assignment', async () => {
  const route = await read('src/app/api/events/[eventId]/check-in/route.ts');
  assert.match(route, /checked_in_by = CASE WHEN \$3 THEN \$4::uuid ELSE NULL END/);
});

test('published retention and deletion terms match the support-request workflow', async () => {
  const terms = await read('src/app/(marketing)/terms/page.tsx');
  const privacy = await read('src/app/(marketing)/privacy/page.tsx');
  for (const policy of [terms, privacy]) {
    assert.match(policy, /request.*deletion/i);
    assert.match(policy, /verify the request/i);
    assert.match(policy, /within 30 days/i);
    assert.match(policy, /legal/i);
  }
});

test('verified account deletion is cancellable, subscription-safe, and executed by authenticated maintenance', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const route = await read('src/app/api/account/deletion/route.ts');
  const cron = await read('src/app/api/cron/delete-accounts/route.ts');
  const settings = await read('src/app/(dashboard)/settings/page.tsx');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS account_deletion_requests/);
  assert.match(route, /requireApiHost/);
  assert.match(route, /INTERVAL '7 days'/);
  assert.match(route, /Cancel the active subscription/);
  assert.match(cron, /FOR UPDATE SKIP LOCKED/);
  assert.match(cron, /DELETE FROM events WHERE user_id/);
  assert.match(cron, /DELETE FROM admin_users/);
  assert.match(cron, /deleted_account_upload_cleanup/);
  assert.match(settings, /Download account export/);
  assert.match(settings, /Schedule account deletion/);
});

test('storage is quota-backed and destructive retention jobs default off', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const upload = await read('src/app/api/upload/route.ts');
  const drafts = await read('src/app/api/cron/cleanup-drafts/route.ts');
  const uploads = await read('src/app/api/cron/cleanup-uploads/route.ts');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS upload_assets/);
  assert.match(upload, /pg_advisory_xact_lock/);
  assert.match(upload, /Storage quota exceeded/);
  assert.match(drafts, /ENABLE_STALE_DRAFT_CLEANUP/);
  assert.match(drafts, /updated_at < \$2/);
  assert.match(uploads, /ENABLE_ORPHAN_UPLOAD_CLEANUP/);
  assert.match(uploads, /NOT EXISTS \(SELECT 1 FROM events/);
});

test('operations metrics are secret-gated and exclude guest content', async () => {
  const route = await read('src/app/api/operations/metrics/route.ts');
  const auth = await read('src/lib/operations-auth.ts');
  assert.match(route, /isOperationsAuthorized/);
  assert.match(auth, /OPERATIONS_SECRET/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(route, /status: 404/);
  assert.match(route, /activation_events/);
  assert.doesNotMatch(route, /respondent_name|respondent_email|message\s+FROM|recipient/);
});

test('host lifecycle emails are deduplicated, controlled, and disabled by default', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const route = await read('src/app/api/cron/send-host-lifecycle/route.ts');
  const example = await read('.env.example');
  assert.match(schema, /scope_key TEXT UNIQUE NOT NULL/);
  assert.match(route, /ENABLE_HOST_LIFECYCLE_EMAILS/);
  assert.match(route, /sendEmail/);
  assert.match(route, /ON CONFLICT \(scope_key\) DO NOTHING/);
  assert.match(example, /ENABLE_HOST_LIFECYCLE_EMAILS=false/);
});

test('checkout conversion telemetry is recorded only at real lifecycle boundaries', async () => {
  const eventCheckout = await read('src/app/api/checkout/route.ts');
  const annualCheckout = await read('src/app/api/subscriptions/checkout/route.ts');
  const webhook = await read('src/app/api/webhooks/stripe/route.ts');
  assert.match(eventCheckout, /name: 'checkout_started'/);
  assert.match(annualCheckout, /name: "checkout_started"/);
  assert.match(webhook, /name: "checkout_completed"/);
  assert.match(webhook, /payment_status !== "paid"/);
});

test('checkout failures are retained as accessible inline errors rather than browser alerts', async () => {
  const pricing = await read('src/components/pricing/PricingCards.tsx');
  const upgrade = await read('src/components/events/UpgradeButton.tsx');
  for (const source of [pricing, upgrade]) {
    assert.match(source, /role="alert"/);
    assert.match(source, /checkoutError/);
    assert.doesNotMatch(source, /\balert\(/);
  }
});

test('host management failures are retained as accessible inline errors rather than browser alerts', async () => {
  const sources = await Promise.all([
    read('src/components/dashboard/CloneEventButton.tsx'),
    read('src/app/(dashboard)/events/[eventId]/guests/page.tsx'),
    read('src/app/(dashboard)/events/[eventId]/comments/page.tsx'),
  ]);
  for (const source of sources) {
    assert.match(source, /role=(?:"alert"|\{notice\.tone === "error" \? "alert" : "status"\})/);
    assert.doesNotMatch(source, /\balert\(/);
  }
});

test('provider callbacks are authenticated, replay-safe, and retry transient failures', async () => {
  const stripe = await read('src/app/api/webhooks/stripe/route.ts');
  const mailgun = await read('src/app/api/webhooks/mailgun/route.ts');
  const twilio = await read('src/app/api/webhooks/twilio/route.ts');
  assert.match(stripe, /constructEvent/);
  assert.match(stripe, /checkout\.session\.async_payment_succeeded/);
  assert.match(stripe, /invoice\.paid/);
  assert.match(stripe, /INSERT INTO webhook_receipts/);
  assert.match(stripe, /DELETE FROM webhook_receipts/);
  assert.match(mailgun, /timingSafeEqual/);
  assert.match(mailgun, /INSERT INTO webhook_receipts/);
  assert.match(twilio, /timingSafeEqual/);
  assert.match(twilio, /INSERT INTO webhook_receipts/);
  assert.match(twilio, /status: 500/);
});

test('Twilio incoming opt-out events synchronize the local SMS suppression state', async () => {
  const twilio = await read('src/app/api/webhooks/twilio/route.ts');
  const inbound = await read('src/lib/twilio-inbound-opt-out.ts');

  assert.match(twilio, /processTwilioOptOutEvent/);
  assert.match(twilio, /data\.OptOutType/);
  assert.match(twilio, /data\.From/);
  assert.match(twilio, /BEGIN[\s\S]*processTwilioOptOutEvent[\s\S]*COMMIT/);
  assert.match(twilio, /<Response><\/Response>/);
  assert.match(inbound, /STOP[\s\S]*recordCommunicationSuppression/);
  assert.match(inbound, /START[\s\S]*removeCommunicationSuppressionsForRecipient/);
  assert.match(inbound, /HELP/);
  assert.match(inbound, /INSERT INTO webhook_receipts/);
  assert.match(inbound, /JOIN events/);
});

test('complaints, unsubscribes, bounces, and invalid phones block future guest communications', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const mailgun = await read('src/app/api/webhooks/mailgun/route.ts');
  const invitations = await read('src/app/api/events/[eventId]/send-invites/route.ts');
  const reminders = await read('src/app/api/events/[eventId]/send-reminders/route.ts');
  const scheduledReminders = await read('src/app/api/cron/send-reminders/route.ts');
  const announcements = await read('src/lib/messages/dispatch-announcement.ts');
  const guestUpdate = await read('src/app/api/events/[eventId]/guests/[guestId]/route.ts');

  for (const sql of [schema, migration]) {
    assert.match(sql, /communication_suppressions/);
    assert.match(sql, /recipient_hash/);
    assert.match(sql, /(?:UNIQUE|PRIMARY KEY)\s*\(user_id, channel, recipient_hash\)/);
  }
  assert.match(mailgun, /recordCommunicationSuppression/);
  assert.match(mailgun, /unsubscribed[\s\S]*complained[\s\S]*bounced/);
  for (const sender of [invitations, reminders, scheduledReminders, announcements]) {
    assert.match(sender, /getCommunicationSuppressions/);
    assert.match(sender, /isCommunicationSuppressed/);
  }
  assert.match(invitations, /phone_invalid_at/);
  assert.match(reminders, /phone_invalid_at/);
  assert.match(scheduledReminders, /phone_invalid_at/);
  for (const sender of [invitations, reminders, scheduledReminders, announcements]) {
    assert.match(sender, /SET phone_invalid_at = NOW\(\)/);
  }
  assert.match(guestUpdate, /phone_invalid_at = NULL/);
});

test('operations readiness is secret-gated and never returns credential values', async () => {
  const route = await read('src/app/api/operations/readiness/route.ts');
  const readiness = await read('src/lib/provider-readiness.ts');
  const operatorScript = await read('ops/check-provider-readiness.sh');
  assert.match(route, /isOperationsAuthorized/);
  assert.match(route, /status: 404/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.doesNotMatch(readiness, /return.*STRIPE_SECRET_KEY|return.*MAILGUN_API_KEY|return.*TWILIO_AUTH_TOKEN/);
  assert.match(operatorScript, /coolify\.resourceName=seal-send/);
  assert.match(operatorScript, /Authorization: Bearer \$OPERATIONS_SECRET/);
  assert.match(operatorScript, /api\/operations\/readiness/);
  assert.doesNotMatch(operatorScript, /echo.*OPERATIONS_SECRET|set -x/);
});

test('authentication codes are hashed and scoped to one login context', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const migration = await read('apply-security-indexes.sql');
  const send = await read('src/app/api/auth/send-code/route.ts');
  const verify = await read('src/app/api/auth/verify-code/route.ts');
  const password = await read('src/app/api/auth/login-password/route.ts');
  assert.match(schema, /code_hash TEXT NOT NULL/);
  assert.doesNotMatch(schema, /\n\s*code TEXT NOT NULL/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS code_hash/);
  assert.match(send, /hashAuthCode/);
  assert.match(send, /event_id IS NOT DISTINCT FROM/);
  assert.match(verify, /code_hash = \$2/);
  assert.match(verify, /event_id IS NOT DISTINCT FROM \$4/);
  assert.match(password, /DUMMY_PASSWORD_HASH/);
});

test('operator-created admin accounts require a hashed password and never print credentials', async () => {
  const script = await read('scripts/create-admin.ts');
  assert.match(script, /SEALSEND_ADMIN_PASSWORD/);
  assert.match(script, /hashPassword/);
  assert.match(script, /INSERT INTO admin_users \(email, password, name\)/);
  assert.doesNotMatch(script, /console\.log\([^\n]*password/i);
  assert.doesNotMatch(script, /INSERT INTO admin_users \(email\) VALUES/);
});

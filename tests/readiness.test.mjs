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
  assert.match(schema, /CREATE TABLE IF NOT EXISTS beta_feedback/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS server_error_events/);
  assert.doesNotMatch(monitoring, /error\.message|error\.stack/);
  assert.match(instrumentation, /onRequestError/);
  assert.match(feedback, /requireApiHost/);
  assert.match(feedback, /rateLimit/);
});

test('communication review exposes resolved recipients, cost status, controls, and a separate approval gate', async () => {
  const audience = await read('src/app/api/events/[eventId]/announcements/audience/route.ts');
  const draft = await read('src/app/api/events/[eventId]/announcements/draft/route.ts');
  const modal = await read('src/components/dashboard/SendAnnouncementModal.tsx');
  assert.match(audience, /recipients:/);
  assert.match(audience, /estimatedCostMicros/);
  for (const control of ['tone', 'length', 'urgency', 'channel']) assert.match(draft, new RegExp(control));
  assert.match(modal, /Review resolved recipients/);
  assert.match(modal, /Estimated provider charge/);
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

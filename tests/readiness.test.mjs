import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
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

// The app runs on SQLite / Cloudflare D1 and src/lib/db/schema.sql is the only schema. The old
// Postgres upgrade migration (apply-security-indexes.sql) is gone, so "fresh and upgraded" schema
// checks now only cover the fresh schema; where they protected a constraint, it is exercised here
// against a real in-memory SQLite database built from schema.sql.
let schemaSql;
async function freshDb() {
  schemaSql ??= await read('src/lib/db/schema.sql');
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(schemaSql);
  return db;
}

function seedUser(db, id = 'user-1', name = 'Host') {
  db.prepare("INSERT INTO admin_users (id, email, password, name) VALUES (?, ?, 'x', ?)").run(id, `${id}@example.com`, name);
}

function seedEvent(db, id = 'event-1', userId = 'user-1', extra = {}) {
  const columns = ['id', 'user_id', 'title', 'slug', ...Object.keys(extra)];
  const values = [id, userId, 'Party', `slug-${id}`, ...Object.values(extra)];
  db.prepare(`INSERT INTO events (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...values);
}

function seedOrganization(db, id = 'org-1', userId = 'user-1') {
  db.prepare("INSERT INTO organizations (id, name, slug, created_by) VALUES (?, 'Studio', ?, ?)").run(id, `org-${id}`, userId);
}

const rejectsConstraint = (fn, message) => assert.throws(fn, /constraint/i, message);

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

test('fresh guest schema supports reminder tracking', async () => {
  // Formerly "fresh and upgraded": the upgrade migration no longer exists; only schema.sql is checked.
  const schema = await read('src/lib/db/schema.sql');
  const guests = schema.match(/CREATE TABLE IF NOT EXISTS guests \([\s\S]*?\n\);/)?.[0];

  assert.ok(guests, 'guests table definition is missing');
  assert.match(guests, /reminder_sent_at\s+TIMESTAMP_TEXT/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_guests_event_reminder ON guests \(event_id, reminder_sent_at\)/);
});

test('fresh schema accepts the Event Pass tier', async () => {
  const schema = await read('src/lib/db/schema.sql');
  assert.match(tableDefinition(schema, 'events'), /CHECK \(\(tier IN \('free', 'event_pass',/);

  const db = await freshDb();
  seedUser(db);
  seedEvent(db, 'event-pass', 'user-1', { tier: 'event_pass' });
  rejectsConstraint(() => seedEvent(db, 'event-bad-tier', 'user-1', { tier: 'unlimited' }), 'unknown tiers are rejected');
});

test('fresh schema creates the Event Pass SMS ledger', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const ledger = tableDefinition(schema, 'event_sms_ledger');
  assert.ok(ledger, 'event_sms_ledger table definition is missing');
  assert.match(ledger, /CHECK \(\(reason IN \('event_pass', 'sms_top_up', 'sms_sent'\)\)\)/);
  assert.match(ledger, /UNIQUE \(reference\)/);

  const db = await freshDb();
  seedUser(db);
  seedEvent(db);
  const insert = db.prepare('INSERT INTO event_sms_ledger (event_id, delta_segments, reason, reference) VALUES (?, ?, ?, ?)');
  insert.run('event-1', 100, 'event_pass', 'cs_1');
  rejectsConstraint(() => insert.run('event-1', 100, 'event_pass', 'cs_1'), 'a purchase reference is credited once');
  rejectsConstraint(() => insert.run('event-1', 5, 'gift', 'cs_2'), 'unknown ledger reasons are rejected');
});

test('fresh schema gives every event a workspace', async () => {
  const schema = await read('src/lib/db/schema.sql');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations \(/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organization_members \(/);
  assert.match(tableDefinition(schema, 'organization_members'), /CHECK \(\(role IN \('owner', 'admin', 'planner', 'check_in'\)\)\)/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_personal_owner ON organizations \(created_by\) WHERE is_personal/);
  assert.match(tableDefinition(schema, 'events'), /FOREIGN KEY \(organization_id\) REFERENCES organizations\(id\)/);
  assert.match(schema, /CREATE TRIGGER IF NOT EXISTS events_default_organization AFTER INSERT ON events/);

  // The trigger replaces sealsend_personal_organization(): an event inserted without a workspace
  // lands in the owner's personal workspace, created once with an owner membership.
  const db = await freshDb();
  seedUser(db);
  seedEvent(db, 'event-1');
  seedEvent(db, 'event-2');
  const events = db.prepare('SELECT organization_id FROM events ORDER BY id').all();
  assert.ok(events[0].organization_id, 'new events get a workspace');
  assert.equal(events[1].organization_id, events[0].organization_id, 'the personal workspace is reused');
  const membership = db.prepare('SELECT o.is_personal, m.role FROM organizations o JOIN organization_members m ON m.organization_id = o.id WHERE o.id = ? AND m.user_id = ?').get(events[0].organization_id, 'user-1');
  assert.equal(membership.is_personal, 1);
  assert.equal(membership.role, 'owner');
  rejectsConstraint(() => db.prepare("INSERT INTO organizations (name, slug, is_personal, created_by) VALUES ('Again', 'again', 1, 'user-1')").run(), 'one personal workspace per host');
  rejectsConstraint(() => db.prepare("INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, 'user-1', 'superuser')").run(events[0].organization_id), 'unknown roles are rejected');
});

test('fresh schema creates the workspace brand kit', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const brands = tableDefinition(schema, 'brands');
  assert.ok(brands, 'brands table definition is missing');
  assert.match(brands, /organization_id TEXT NOT NULL/);
  assert.match(brands, /FOREIGN KEY \(organization_id\) REFERENCES organizations\(id\) ON DELETE CASCADE/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_default_per_organization ON brands \(organization_id\) WHERE is_default/);
  assert.match(tableDefinition(schema, 'events'), /FOREIGN KEY \(brand_id\) REFERENCES brands\(id\) ON DELETE SET NULL/);

  const db = await freshDb();
  seedUser(db);
  seedOrganization(db);
  const insert = db.prepare("INSERT INTO brands (organization_id, name, is_default) VALUES ('org-1', ?, 1)");
  insert.run('Main');
  rejectsConstraint(() => insert.run('Second'), 'one default brand per workspace');
  rejectsConstraint(() => db.prepare("INSERT INTO brands (organization_id, name, primary_color) VALUES ('org-1', 'Bad', 'red')").run(), 'brand colours must be #RRGGBB');
});

test('fresh schema stores workspace invites as hashed one-time tokens', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const invites = tableDefinition(schema, 'organization_invites');
  assert.ok(invites, 'organization_invites table definition is missing');
  assert.match(invites, /CHECK \(\(role IN \('admin', 'planner', 'check_in'\)\)\)/);
  assert.match(invites, /token_hash TEXT NOT NULL/);
  assert.match(invites, /UNIQUE \(token_hash\)/);
  assert.doesNotMatch(invites, /\btoken TEXT/);

  const db = await freshDb();
  seedUser(db);
  seedOrganization(db);
  const insert = db.prepare("INSERT INTO organization_invites (organization_id, email, role, token_hash, token_preview, invited_by, expires_at) VALUES ('org-1', 'a@example.com', ?, ?, 'abcd', 'user-1', '2030-01-01T00:00:00.000Z')");
  insert.run('planner', 'hash-1');
  rejectsConstraint(() => insert.run('planner', 'hash-1'), 'token hashes are unique');
  rejectsConstraint(() => insert.run('owner', 'hash-2'), 'invites cannot grant ownership');
});

test('fresh schema creates clients and hashed client review links', async () => {
  const schema = await read('src/lib/db/schema.sql');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS clients \(/);
  assert.match(tableDefinition(schema, 'events'), /FOREIGN KEY \(client_id\) REFERENCES clients\(id\) ON DELETE SET NULL/);
  const shares = tableDefinition(schema, 'event_client_shares');
  assert.ok(shares, 'event_client_shares table definition is missing');
  assert.match(shares, /token_hash TEXT NOT NULL,\n  token_preview TEXT NOT NULL,\n  created_by TEXT/);
  assert.match(shares, /UNIQUE \(token_hash\)/);
});

test('fresh schema creates workspace webhooks and their delivery queue', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const webhooks = tableDefinition(schema, 'organization_webhooks');
  const deliveries = tableDefinition(schema, 'webhook_deliveries');
  assert.match(webhooks, /CREATE TABLE IF NOT EXISTS organization_webhooks \(\n  id TEXT PRIMARY KEY DEFAULT [^\n]+\n  organization_id TEXT NOT NULL,/);
  assert.match(webhooks, /FOREIGN KEY \(organization_id\) REFERENCES organizations\(id\) ON DELETE CASCADE/);
  assert.match(deliveries, /CREATE TABLE IF NOT EXISTS webhook_deliveries \(\n  id TEXT PRIMARY KEY DEFAULT [^\n]+\n  webhook_id TEXT NOT NULL,/);
  assert.match(deliveries, /FOREIGN KEY \(webhook_id\) REFERENCES organization_webhooks\(id\) ON DELETE CASCADE/);
  assert.match(deliveries, /status TEXT NOT NULL DEFAULT 'pending'/);
  assert.match(deliveries, /CHECK \(\(status IN \('pending', 'delivered', 'failed'\)\)\)/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due ON webhook_deliveries \(next_attempt_at\) WHERE \(status = 'pending'\)/);

  const db = await freshDb();
  seedUser(db);
  seedOrganization(db);
  db.prepare("INSERT INTO organization_webhooks (id, organization_id, url, secret, events) VALUES ('hook-1', 'org-1', 'https://example.com/hook', 's', '[\"rsvp.created\"]')").run();
  rejectsConstraint(() => db.prepare("INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status) VALUES ('hook-1', 'rsvp.created', '{}', 'sent')").run(), 'unknown delivery statuses are rejected');
  rejectsConstraint(() => db.prepare("INSERT INTO organization_webhooks (organization_id, url, secret, events) VALUES ('org-1', 'https://example.com/hook', 's', '[]')").run(), 'a webhook subscribes to at least one event');
});

test('webhook delivery runs from a CRON_SECRET-protected cron route with a DNS-checked, redirect-free POST', async () => {
  const route = await read('src/app/api/cron/deliver-webhooks/route.ts');
  const lib = await read('src/lib/webhooks.ts');
  const nodeTransport = await read('src/lib/webhook-transport.ts');
  const workerTransport = await read('src/lib/webhook-transport.cloudflare.ts');
  assert.match(route, /Bearer \$\{cronSecret\}/);
  assert.match(route, /deliverDueWebhooks/);
  assert.match(nodeTransport, /lookup: publicOnlyLookup/);
  assert.doesNotMatch(nodeTransport, /\bfetch\(/);
  // Claiming (formerly FOR UPDATE SKIP LOCKED) is one atomic UPDATE ... WHERE id IN (SELECT ... LIMIT n)
  // that re-checks the row is still due and pushes next_attempt_at out so overlapping runs skip it.
  assert.match(lib, /UPDATE webhook_deliveries\s+SET next_attempt_at = \$\{sqlNowPlus\("\+\d+ minutes"\)\}\s+WHERE id IN \(/);
  assert.match(lib, /LIMIT \$1\)\s+AND status = 'pending' AND next_attempt_at <= \$\{SQL_NOW\}\s+RETURNING id/);
  assert.match(lib, /JOIN organization_webhooks endpoint ON endpoint.id = pending.webhook_id AND endpoint.active = 1/);
  assert.doesNotMatch(lib, /\bfetch\(/);
  // The Workers transport has no dns module: it checks DNS-over-HTTPS answers and never follows redirects.
  assert.match(workerTransport, /redirect: "manual"/);
  assert.match(workerTransport, /addresses\.some\(isPrivateAddress\)/);
});

test('the welcome tour shows once, only to new hosts, and is an accessible dialog', async () => {
  const tour = await read('src/components/onboarding/WelcomeTour.tsx');
  const dashboard = await read('src/app/(dashboard)/dashboard/page.tsx');
  assert.match(dashboard, /<WelcomeTour userId=\{user\.id\} show=\{user\.role === 'admin' && myEvents\.length === 0 && collaboratingEvents\.length === 0\} \/>/);
  assert.match(tour, /role="dialog"/);
  assert.match(tour, /aria-modal="true"/);
  assert.match(tour, /event\.key === "Escape"/);
  assert.match(tour, /event\.key !== "Tab"/);
  assert.match(tour, /useReducedMotion/);
  assert.match(tour, /try \{\s*localStorage\.setItem\(welcomeTourStorageKey\(userId\), "done"\)/);
  assert.match(tour, /`\$\{WELCOME_TOUR_STORAGE_KEY\}:\$\{userId\}`/);
  assert.match(tour, /href="\/events\/new"/);
});

test('dashboard confirmations use the accessible dialog, not window.confirm', async () => {
  const { execFileSync } = await import('node:child_process');
  const files = execFileSync('git', ['ls-files', 'src/**/*.tsx', 'src/**/*.ts'], { encoding: 'utf8' }).trim().split('\n');
  const offenders = [];
  for (const file of files) {
    if (file === 'src/components/ui/Feedback.tsx') continue;
    const source = await read(file);
    if (/(^|[^.\w])confirm\(\s*[`'"]/m.test(source) || /window\.confirm\(/.test(source) || /(^|[^.\w])alert\(/m.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
  const layout = await read('src/app/(dashboard)/layout.tsx');
  assert.match(layout, /<FeedbackProvider>/);
  const feedback = await read('src/components/ui/Feedback.tsx');
  assert.match(feedback, /role="alertdialog"/);
  assert.match(feedback, /cancelRef\.current\?\.focus\(\)/);
});

test('text-muted-foreground is a registered theme colour and touch targets reach 44px', async () => {
  const css = await read('src/app/globals.css');
  const theme = css.slice(css.indexOf('@theme inline {'), css.indexOf('}', css.indexOf('@theme inline {')));
  assert.match(theme, /--color-muted-foreground: var\(--color-neutral-600\);/);
  assert.match(theme, /--color-accent-red: var\(--color-error-700\);/);
  assert.match(theme, /--color-accent-green: var\(--color-success-700\);/);
  assert.match(theme, /--color-accent-amber: var\(--color-/);
  const button = await read('src/components/ui/Button.tsx');
  assert.match(button, /md: "[^"]*any-pointer-coarse:h-11/);
  assert.match(button, /icon: "[^"]*any-pointer-coarse:h-11 any-pointer-coarse:w-11/);
  const tabBar = await read('src/components/layout/MobileTabBar.tsx');
  assert.match(tabBar, /min-h-14/);
  assert.match(tabBar, /aria-current=\{isActive \? 'page' : undefined\}/);
});

test('public marketing pages linked from the footer do not require a login', async () => {
  const proxy = await read('src/proxy.ts');
  const footer = await read('src/components/layout/Footer.tsx');
  const publicList = proxy.slice(proxy.indexOf('const publicPaths = ['), proxy.indexOf('];', proxy.indexOf('const publicPaths = [')));
  // Footer links are data (href: "/path") or JSX (href="/path"); both forms are checked.
  const hrefs = [...footer.matchAll(/href(?:=|:\s*)"(\/[a-z-]+)(?:\/[a-z-]+)?"/g)];
  assert.ok(hrefs.length >= 10, 'expected the footer links to be found');
  for (const href of hrefs) {
    assert.match(publicList, new RegExp(`'${href[1]}'`), `${href[1]} is linked from the footer but not public`);
  }
});

test('fresh schema creates the waitlist signup table', async () => {
  // Formerly "fresh and upgraded": only schema.sql exists now.
  const schema = await read('src/lib/db/schema.sql');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS waitlist_signups \(/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_email_plan\s+ON waitlist_signups \(lower\(email\), plan_interest\)/);

  const db = await freshDb();
  const insert = db.prepare("INSERT INTO waitlist_signups (email, plan_interest) VALUES (?, 'pro_annual')");
  insert.run('Host@Example.com');
  rejectsConstraint(() => insert.run('host@example.com'), 'one signup per email (case-insensitive) and plan');
});

test('the schema constrains the send logging contract', async () => {
  // The Postgres upgrade migration that backfilled send_type from channel is gone (existing rows are
  // copied at cutover); the constraints it added are part of schema.sql and enforced here.
  const schema = await read('src/lib/db/schema.sql');
  const sendLogs = tableDefinition(schema, 'send_logs');
  assert.match(sendLogs, /send_type TEXT NOT NULL/);
  assert.match(sendLogs, /CHECK \(\(status IN \('pending', 'sent', 'failed', 'bounced', 'delivered'\)\)\)/);

  const db = await freshDb();
  seedUser(db);
  seedEvent(db);
  const insert = db.prepare("INSERT INTO send_logs (event_id, send_type, status, recipient) VALUES ('event-1', ?, ?, 'a@example.com')");
  insert.run('email', 'sent');
  rejectsConstraint(() => insert.run(null, 'sent'), 'send_type is required');
  rejectsConstraint(() => insert.run('email', 'queued'), 'unknown send statuses are rejected');
});

test('feature table schemas match the SQL contracts used by application routes', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const verification = await read('scripts/test/verify-feature-schema.sql');

  assertColumns(schema, 'events', ['location_lat', 'location_lng', 'payment_id', 'event_brief', 'repeated_from_event_id']);
  assert.match(tableDefinition(schema, 'events'), /repeated_from_event_id\s+TEXT,/);
  assert.match(tableDefinition(schema, 'events'), /FOREIGN KEY \(repeated_from_event_id\) REFERENCES events\(id\) ON DELETE SET NULL/);
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
  // "Build" is a required check, so every PR (docs-only too) must report it.
  assert.doesNotMatch(ci, /pull_request:\s*\n\s*paths(-ignore)?:/);
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
  // The hero is a server component with a single CSS seal-press animation that
  // prefers-reduced-motion switches off, so there is no client motion state to hydrate.
  const hero = await read('src/components/marketing/Hero.tsx');
  const css = await read('src/app/globals.css');
  assert.doesNotMatch(hero, /^["']use client["']/m);
  assert.doesNotMatch(hero, /framer-motion|useReducedMotion/);
  assert.doesNotMatch(hero, /repeat:\s*Infinity|infinite/);
  assert.match(hero, /animate-seal-press/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.animate-seal-press[\s\S]*animation: none/);
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

  assert.match(config, /turbopack:\s*\{[\s\S]*?root:\s*process\.cwd\(\)/);
  assert.match(config, /NEXT_PUBLIC_SITE_URL\?\.startsWith\('https:\/\/'\)/);
  assert.match(proxy, /export async function proxy\(/);
  // The generated (edge-prone) Open Graph route was replaced by the static public/brand/og.jpg.
  await assert.rejects(read('src/app/opengraph-image.tsx'));
});

test('browser CI serves the same standalone artifact shape as production', async () => {
  const config = await read('playwright.config.ts');
  const pkg = JSON.parse(await read('package.json'));
  const server = await read('scripts/test/start-playwright-server.mjs');

  const ciWorkflow = await read('.github/workflows/ci.yml');
  assert.match(ciWorkflow, /- name: Build \(standalone\)/);
  assert.match(ciWorkflow, /run: npm run build/);
  assert.ok(ciWorkflow.indexOf('Build (standalone)') < ciWorkflow.indexOf('Browser smoke tests'));
  assert.match(config, /command: 'npm run start:e2e'/);
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
  // The fixture now resets a local SQLite file: only one exactly named file, never remote D1.
  assert.match(fixture, /path\.basename\(sqlitePath\) !== ["']sealsend_e2e\.db["']/);
  assert.match(fixture, /D1_REMOTE === ["']true["'][\s\S]*throw new Error/);
  assert.match(fixture, /for \(const suffix of \["", "-wal", "-shm"\]\) await rm\(`\$\{qaDatabasePath\}\$\{suffix\}`/);
  assert.match(fixture, /db\.exec\(await readFile\(path\.resolve\("src\/lib\/db\/schema\.sql"\)/);
  assert.doesNotMatch(fixture, /console\.log\([^\n]*(?:password|inviteToken|email)/i);
});

test('every publication boundary enforces the shared guest-ready contract', async () => {
  const createRoute = await read('src/app/api/events/route.ts');
  const updateRoute = await read('src/app/api/events/[eventId]/route.ts');
  const publishRoute = await read('src/app/api/events/[eventId]/publish/route.ts');
  const review = await read('src/components/events/builder/screens/ReviewScreen.tsx');
  const eventPage = await read('src/app/(dashboard)/events/[eventId]/page.tsx');
  const publishControl = await read('src/components/dashboard/PublishEventButton.tsx');

  for (const source of [createRoute, updateRoute, publishRoute, review]) {
    assert.match(source, /getPublicationReadiness/);
  }
  assert.match(createRoute, /status\s*===\s*['"]published['"]/);
  assert.match(updateRoute, /targetStatus\s*=\s*parsed\.data\.status\s*\?\?\s*existing\.status/);
  assert.match(updateRoute, /targetStatus\s*===\s*['"]published['"]/);
  assert.match(updateRoute, /existing\.status\s*===\s*['"]archived['"][\s\S]*targetStatus\s*!==\s*['"]archived['"]/);
  assert.match(publishRoute, /readiness\.ready/);
  assert.match(publishRoute, /event\.status\s*===\s*['"]archived['"]/);
  assert.match(review, /Must-haves/);
  assert.doesNotMatch(eventPage, /UPDATE events SET status/);
  assert.match(eventPage, /PublishEventButton/);
  assert.match(publishControl, /\/api\/events\/\$\{eventId\}\/publish/);
  assert.match(publishControl, /blockers/);
  assert.match(publishControl, /Review event details/);
  assert.match(publishControl, /role=["']alert["']/);
});

test('manual event creation exposes every required publication decision', async () => {
  const review = await read('src/components/events/builder/screens/ReviewScreen.tsx');
  const mapping = await read('src/lib/event-builder/mapping.ts');

  assert.match(review, /id=["']review-headline["']/);
  assert.match(review, /invitation_headline/);
  assert.match(review, /id=["']review-body["']/);
  assert.match(review, /invitation_body/);
  assert.match(mapping, /invitation_headline:\s*data\.invitation_headline/);
  assert.match(mapping, /invitation_body:\s*data\.invitation_body/);
  assert.match(mapping, /event_brief:\s*data\.event_brief/);
});

test('structured event brief survives generation, storage, editing, and publication checks', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const validation = await read('src/lib/validations.ts');
  const createRoute = await read('src/app/api/events/route.ts');
  const updateRoute = await read('src/app/api/events/[eventId]/route.ts');
  const publishRoute = await read('src/app/api/events/[eventId]/publish/route.ts');
  const aiRoute = await read('src/app/api/ai/event-draft/route.ts');
  const mapping = await read('src/lib/event-builder/mapping.ts');

  assert.match(tableDefinition(schema, 'events'), /event_brief JSON_TEXT,/);
  assert.match(validation, /event_brief:\s*eventBriefContextSchema/);
  assert.match(createRoute, /event_brief/);
  assert.match(updateRoute, /event_brief/);
  assert.match(publishRoute, /event_brief/);
  assert.match(aiRoute, /brief:\s*eventBriefSchema/);
  assert.match(mapping, /event_brief:\s*event\.event_brief/);
  assert.match(mapping, /event_brief:\s*data\.event_brief/);
});

test('database rate limiting serializes attempts for the same key', async () => {
  const source = await read('src/lib/rate-limit.ts');

  // Formerly BEGIN + pg_advisory_xact_lock: the prune, count and insert now run in one batch (D1 runs
  // batches one at a time) and the insert itself re-counts, so concurrent attempts cannot overshoot.
  assert.match(source, /await batch<\{ count: number \}>\(\[\s*\{\s*text: 'DELETE FROM rate_limit_attempts WHERE key = \$1 AND created_at < \$2'/);
  assert.match(source, /SELECT COUNT\(\*\) AS count FROM rate_limit_attempts WHERE key = \$1 AND created_at >= \$2/);
  assert.match(source, /INSERT INTO rate_limit_attempts \(key\)[\s\S]*WHERE \(SELECT COUNT\(\*\) FROM rate_limit_attempts WHERE key = \$1 AND created_at >= \$3\) \+ \$2 <= \$4/);
  assert.doesNotMatch(source, /client\.query\(['"]BEGIN['"]\)/);
});

test('paid checkout documents every Stripe price ID consumed by the app', async () => {
  const envExample = await read('.env.example');
  const checkout = await read('src/app/api/subscriptions/checkout/route.ts');

  assert.match(envExample, /^STRIPE_PRO_YEARLY_PRICE_ID=/m);
  assert.match(checkout, /process\.env\.STRIPE_PRO_YEARLY_PRICE_ID/);
  assert.doesNotMatch(envExample, /STRIPE_(SILVER|GOLD)_(MONTHLY|YEARLY)_PRICE_ID/);
});

test('annual Pro is accepted by the subscription schema', async () => {
  // Formerly "fresh and upgraded": only schema.sql exists now.
  const schema = await read('src/lib/db/schema.sql');
  const webhook = await read('src/app/api/webhooks/stripe/route.ts');

  assert.match(tableDefinition(schema, 'user_subscriptions'), /CHECK \(\(tier IN \('free', 'pro_annual'\)\)\)/);
  const db = await freshDb();
  const insert = db.prepare("INSERT INTO user_subscriptions (user_id, tier, billing_cycle) VALUES ('user-1', ?, 'yearly')");
  insert.run('pro_annual');
  rejectsConstraint(() => insert.run('gold'), 'retired tiers are rejected');
  assert.match(webhook, /session\.payment_status/);
});

test('public capacity writes are serialized and RSVP plus-ones are atomic', async () => {
  const rsvp = await read('src/app/api/rsvp/[slug]/route.ts');
  const signups = await read('src/app/api/signups/[slug]/route.ts');

  const store = await read('src/lib/rsvp-store.ts');
  // Formerly an advisory lock + BEGIN/COMMIT: the RSVP is written in one batch whose guards re-check
  // the response limit and capacity when it runs, and the response and plus-ones share that batch.
  assert.match(store, /guard\('\(SELECT COUNT\(\*\) FROM rsvp_responses WHERE event_id = \$1\) < \$2', \[eventId, responseLimit\], 'response_limit'\)/);
  assert.match(store, /guard\(`\(\$\{attendingTotalSql\}\) \+ \$3 <= \$4`, \[eventId, previous\?\.id \?\? null, headcount, event\.max_attendees\], 'capacity'\)/);
  assert.match(store, /if \(code === 'capacity'\) throw capacityError/);
  assert.match(store, /INSERT INTO rsvp_responses[\s\S]*INSERT INTO plus_ones[\s\S]*results = await db\.batch\(statements\)/);
  assert.match(rsvp, /saveRsvp\(\{ query, batch \}/);
  assert.doesNotMatch(rsvp, /Don't fail the RSVP if plus_ones creation fails/);
  // Sign-up claims: the free-slot check is a guard in the same batch as the insert.
  assert.match(signups, /await batch\(\[[\s\S]*guard\(\s*'\(SELECT COUNT\(\*\) FROM event_signup_claims WHERE item_id = \$1\) < \(SELECT slots FROM event_signup_items WHERE id = \$1\)',\s*\[item\.id\], 'slots_taken'\s*\),\s*\{\s*text: `INSERT INTO event_signup_claims/);
  assert.match(signups, /if \(code === 'slots_taken'\) return NextResponse\.json\(\{ error: "All slots are taken" \}, \{ status: 403 \}\)/);
});

test('event instants preserve the host timezone across browser, database, and invitations', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const mapping = await read('src/lib/event-builder/mapping.ts');
  const invitation = await read('src/lib/email-templates.ts');

  // Instants are stored as ISO-8601 UTC text next to the host's IANA zone (no upgrade migration anymore).
  assert.match(tableDefinition(schema, 'events'), /event_timezone TEXT NOT NULL DEFAULT 'UTC'/);
  assert.match(tableDefinition(schema, 'events'), /event_date TIMESTAMP_TEXT,/);
  assert.match(mapping, /zonedLocalDateTimeToInstant\(/);
  assert.doesNotMatch(mapping, /new Date\((?:data|value|next|local|formData)[^)]*\)\.toISOString\(\)/);
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
  const factStrip = await read('src/components/marketing/FactStrip.tsx');
  const marketingDirectory = new URL('../src/components/marketing/', import.meta.url);
  const marketingComponents = await Promise.all(
    (await readdir(marketingDirectory))
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => read(`src/components/marketing/${file}`)),
  );

  assert.doesNotMatch(marketingPage, /<Testimonials\s*\/>/);
  assert.doesNotMatch(useCasePage, /<UseCaseTestimonial\b/);
  for (const source of [hero, pricingCta, cta, factStrip]) {
    assert.doesNotMatch(source, /\d[\d,.]*\+|thousands of|4\.9\/5|99%|trusted by|loved by/i);
  }
  for (const source of marketingComponents) {
    assert.doesNotMatch(source, /10,000\+|200,000\+|500K\+|4\.9\/5|99% satisfaction/i);
    assert.doesNotMatch(source, /Sarah Mitchell|David Chen|Emily Rodriguez/);
  }
  // The fact strip states product facts; the guest limit is read from the plan constants.
  assert.match(factStrip, /PUBLIC_PRICING_PLANS/);
  assert.match(factStrip, /Guests never need an account/);
});

test('public offer is a bounded controlled beta with BETA_MODE-aware calls to action', async () => {
  const constants = await read('src/lib/constants.ts');
  const hero = await read('src/components/marketing/Hero.tsx');
  const cta = await read('src/components/marketing/Cta.tsx');
  const howItWorks = await read('src/components/marketing/HowItWorks.tsx');
  const pricingTeaser = await read('src/components/marketing/PricingTeaser.tsx');
  const pricingCards = await read('src/components/pricing/PricingCards.tsx');
  const pricingFaq = await read('src/components/pricing/PricingFAQ.tsx');

  assert.match(constants, /export const BETA_MODE = true/);
  assert.match(constants, /CONTROLLED_BETA_PRICING_PLAN[\s\S]*guests:\s*"100"/);
  assert.match(hero, /Send the invitation\. Know who&apos;s coming\./);
  assert.match(hero, /PRIMARY_CTA_NOTE/);
  assert.match(cta, /BETA_MODE \? "Create a free event" : "Plan your first event free"/);
  assert.match(cta, /Free during the beta: one event, up to 100 guests\./);
  assert.match(cta, /<MarketingSignupLink/);
  for (const stage of [
    'Describe your event',
    'Send it your way',
    'Watch replies arrive, then check guests in',
  ]) {
    assert.match(howItWorks, new RegExp(stage, 'i'));
  }
  // Home page prices come from the billing constants, and the beta keeps its checkout-disabled message.
  assert.match(pricingTeaser, /PUBLIC_PRICING_PLANS\.map/);
  assert.doesNotMatch(pricingTeaser, /\$\d/);
  assert.match(pricingTeaser, /if \(BETA_MODE\)[\s\S]*Paid checkout is disabled during the beta/);
  assert.match(pricingCards, /BETA_MODE\s*\?\s*\[CONTROLLED_BETA_PRICING_PLAN\]/);
  assert.match(pricingFaq, /one active event for up to 100 guests/i);
  assert.match(pricingFaq, /paid checkout is disabled/i);
});

test('public feature marketing stays inside the shipped approval-controlled workflow', async () => {
  const constants = await read('src/lib/constants.ts');
  const features = [
    await read('src/components/marketing/FeatureRows.tsx'),
    await read('src/components/marketing/OrganizersSection.tsx'),
    await read('src/components/marketing/UseCaseGrid.tsx'),
    await read('src/app/(marketing)/page.tsx'),
  ].join('\n');
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
  // Every marketed capability maps to something shipped: templates, RSVP fields, announcements,
  // QR check-in, workspace roles, brand kit, client review links, repeat events and webhooks.
  for (const shippedClaim of [
    'Pick a design',
    'only to guests who said yes',
    'Scan guests in from any phone',
    'owner, admin, planner and check-in roles',
    'Client review links with live RSVP totals and recorded approvals',
    'Repeat an event and keep the guest list',
    'Signed webhooks',
  ]) {
    assert.match(features, new RegExp(shippedClaim, 'i'));
  }
  assert.match(metadata, /SealSend: Online Invitations with RSVP Tracking & Check-in/);
  assert.match(metadata, /Free beta: one event, up to 100 guests\./);
  assert.match(metadata, /\/brand\/og\.jpg/);
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
  // Formerly an advisory lock + transaction: the insert batch carries a guard that the active event
  // count is unchanged since the plan check, and a lost race or slug collision retries from the reads.
  assert.match(events, /statements\.push\(guard\(\s*"\(SELECT COUNT\(\*\) FROM events WHERE user_id = \$1 AND status <> 'archived'\) <= \$2",\s*\[user\.id, eventCount\],\s*'event_count_changed',/);
  assert.match(events, /await batch<Record<string, unknown>>\(statements\)/);
  assert.match(events, /if \(code === 'mutation_exists' \|\| code === 'event_count_changed'\) continue;/);
  assert.match(events, /UNIQUE constraint failed: events\\\.slug/);
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
  assert.match(route, /status\s*<>\s*['"]archived['"]/i);
  assert.match(route, /canCreateEvent/);
  assert.match(route, /archiveSource/);
  assert.match(route, /UPDATE events SET status = ['"]archived['"]/i);
  assert.match(route, /requiresArchive/);
  // Formerly an advisory lock + transaction: the archive and copy run in one batch guarded on the
  // owner and the unchanged active-event count; a lost race retries.
  assert.match(route, /guard\("\(SELECT user_id FROM events WHERE id = \$1\) = \$2", \[eventId, original\.user_id\], "owner_changed"\)/);
  assert.match(route, /guard\(\s*"\(SELECT COUNT\(\*\) FROM events WHERE user_id = \$1 AND status <> 'archived' AND NOT \(id = \$2 AND \$3\)\) <= \$4",[\s\S]*?"event_count_changed",/);
  assert.match(route, /await batch<\{ id: string; title: string \}>\(statements\)/);
  assert.match(route, /if \(code === "event_count_changed"\) continue;/);
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

test('root discovery metadata uses the brief positioning and the committed brand assets', async () => {
  const layout = await read('src/app/layout.tsx');
  const metadata = await read('src/lib/metadata.ts');
  const manifest = JSON.parse(await read('public/manifest.json'));

  assert.match(layout, /title:\s*DEFAULT_TITLE/);
  assert.match(layout, /description:\s*DEFAULT_DESCRIPTION/);
  assert.match(layout, /images:\s*\[OG_IMAGE\]/);
  assert.match(metadata, /url:\s*"\/brand\/og\.jpg",\s*width:\s*1200,\s*height:\s*630/);
  assert.match(layout, /manifest:\s*["']\/manifest\.json["']/);
  assert.match(layout, /\/brand\/favicon-32\.png/);
  assert.match(layout, /\/brand\/apple-touch-icon\.png/);
  assert.match(layout, /Hanken_Grotesk/);
  assert.match(layout, /Libre_Caslon_Display/);
  for (const source of [layout, metadata, JSON.stringify(manifest)]) {
    assert.doesNotMatch(source, /approved guest workflow/i);
  }
  for (const asset of ['public/brand/og.jpg', ...manifest.icons.map((icon) => `public${icon.src}`)]) {
    assert.ok((await readFile(new URL(`../${asset}`, import.meta.url))).length > 0, `${asset} must exist`);
  }
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
  assert.match(support, /free beta/i);
  assert.match(footer, /href(?:=|:\s*)"\/support"/);
  assert.match(sitemap, /`\$\{SITE_URL\}\/support`/);
});

test('the optional service worker never caches authenticated or API responses', async () => {
  const worker = await read('public/sw.js');
  assert.doesNotMatch(worker, /PRECACHE_URLS\s*=\s*\[[^\]]*['"]\/dashboard['"]/);
  assert.match(worker, /pathname\.startsWith\(['"]\/api\/['"]\)/);
  assert.match(worker, /cache\.addAll\(\[OFFLINE\]\)/);
  assert.doesNotMatch(worker, /cache\.put\(/);
  assert.match(worker, /event\.request\.mode !== 'navigate'/);
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
    'event-planners',
    'weddings',
    'birthday-parties',
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

  assert.match(home, /<OrganizersSection\s*\/>/);
  assert.match(indexPage, /<OrganizerFit\s*\/>/);
  // New use-case pages have real hero photos, breadcrumbs and no legacy redirect shadowing them.
  assert.match(detailPage, /breadcrumbJsonLd/);
  assert.match(content, /image: "\/brand\/photos\/weddings\.webp"/);
  assert.match(content, /image: "\/brand\/photos\/birthdays\.webp"/);
  assert.doesNotMatch(content.slice(content.indexOf('LEGACY_USE_CASE_REDIRECTS')), /weddings|birthday-parties/);
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

test('activation analytics has a privacy-limited schema with first-time uniqueness', async () => {
  // Formerly also checked the upgrade path; the upgrade migration no longer exists.
  const schema = await read('src/lib/db/schema.sql');

  const activationTable = tableDefinition(schema, 'activation_events');
  assert.match(activationTable, /event_name TEXT NOT NULL/);
  assert.match(activationTable, /metadata JSON_TEXT NOT NULL DEFAULT '\{\}'/);
  assert.doesNotMatch(activationTable, /email|phone|message|recipient/i);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_user/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_event/);

  const db = await freshDb();
  seedUser(db);
  seedEvent(db);
  const insert = db.prepare('INSERT INTO activation_events (event_name, user_id, event_id) VALUES (?, ?, ?)');
  insert.run('first_rsvp_received', null, 'event-1');
  rejectsConstraint(() => insert.run('first_rsvp_received', null, 'event-1'), 'first-per-event milestones are recorded once');
  insert.run('account_created', 'user-1', null);
  rejectsConstraint(() => insert.run('account_created', 'user-1', null), 'first-per-user milestones are recorded once');
  rejectsConstraint(() => insert.run('page_viewed', 'user-1', null), 'unknown activation events are rejected');
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
  // Recorded only after the RSVP batch succeeded (saveRsvp throws on any guard failure).
  assert.match(rsvpRoute, /const saved = await saveRsvp\([\s\S]*first_rsvp_received/);
});

test('operations scripts schedule authenticated maintenance without exposing secrets', async () => {
  const cron = await read('ops/run-maintenance.sh');
  const cronDefinition = await read('ops/sealsend-maintenance.cron');

  assert.match(cron, /coolify\.resourceName=\$resource/);
  assert.match(cron, /for resource in sealsend seal-send/);
  assert.match(cron, /Authorization: Bearer \$CRON_SECRET/);
  assert.match(cron, /api\/cron\/send-reminders/);
  assert.match(cron, /api\/cron\/cleanup-drafts/);
  assert.doesNotMatch(cron, /echo.*CRON_SECRET|set -x/);
  assert.match(cronDefinition, /run-maintenance\.sh reminders/);
  assert.match(cronDefinition, /run-maintenance\.sh cleanup/);
  assert.match(cron, /webhooks\) endpoint="\/api\/cron\/deliver-webhooks"/);
  assert.match(cronDefinition, /^\* \* \* \* \* root \/opt\/sealsend\/bin\/run-maintenance\.sh webhooks/m);
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

  assert.match(backup, /test "\$POSTGRES_DB" = "sealsend" && test "\$POSTGRES_USER" = "sealsend"/);
  assert.doesNotMatch(backup, /container="sealsend-postgres"/);
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

  const members = tableDefinition(schema, 'event_members');
  const invites = tableDefinition(schema, 'event_member_invites');
  const audit = tableDefinition(schema, 'event_audit_log');

  assert.match(members, /UNIQUE\s*\(event_id, user_id\)/);
  assert.match(members, /CHECK \(\(role IN \('manager', 'check_in', 'viewer'\)\)\)/);
  assert.match(invites, /token_hash TEXT NOT NULL/);
  assert.match(invites, /UNIQUE \(token_hash\)/);
  assert.match(invites, /expires_at TIMESTAMP_TEXT NOT NULL/);
  assert.doesNotMatch(invites, /\btoken TEXT/);
  assert.match(audit, /actor_user_id TEXT/);
  assert.match(audit, /action TEXT NOT NULL/);

  const db = await freshDb();
  seedUser(db, 'owner');
  seedUser(db, 'cohost');
  seedEvent(db, 'event-1', 'owner');
  const addMember = db.prepare("INSERT INTO event_members (event_id, user_id, role, invited_by) VALUES ('event-1', 'cohost', ?, 'owner')");
  addMember.run('manager');
  rejectsConstraint(() => addMember.run('viewer'), 'one membership per event and user');
  rejectsConstraint(() => db.prepare("INSERT INTO event_members (event_id, user_id, role, invited_by) VALUES ('event-1', 'owner', 'owner', 'owner')").run(), 'unknown co-host roles are rejected');
  const invite = db.prepare("INSERT INTO event_member_invites (event_id, email, role, token_hash, token_preview, invited_by, expires_at) VALUES ('event-1', ?, 'viewer', ?, 'abcd', 'owner', '2030-01-01T00:00:00.000Z')");
  invite.run('Guest@Example.com', 'hash-1');
  rejectsConstraint(() => invite.run('guest@example.com', 'hash-2'), 'one pending invite per email (case-insensitive)');
});

test('co-host invitation APIs are owner-gated, capacity-safe, and never persist raw tokens', async () => {
  const membersRoute = await read('src/app/api/events/[eventId]/members/route.ts');
  const memberRoute = await read('src/app/api/events/[eventId]/members/[memberId]/route.ts');
  const acceptRoute = await read('src/app/api/team-invites/[token]/accept/route.ts');

  assert.match(membersRoute, /roleCan\([^,]+, ['"]manage_members['"]\)/);
  // Formerly FOR UPDATE: the seat limit is re-checked by a guard in the same batch as the invite insert.
  assert.match(membersRoute, /guard\(`\$\{occupiedSeatsSql\} < \$2`, \[eventId, teamLimit\], "seat_limit"\)/);
  assert.match(membersRoute, /await batch\(statements\)/);
  assert.match(membersRoute, /if \(code === "seat_limit"\) return seatLimitResponse\(\)/);
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
  // One-time tokens: the batch guards that the invite is still unaccepted and unexpired, then joins and marks it used.
  assert.match(acceptRoute, /await batch\(\[[\s\S]*guard\(\s*`EXISTS \(SELECT 1 FROM event_member_invites WHERE id = \$1 AND accepted_at IS NULL AND expires_at > \$\{SQL_NOW\}\)`,[\s\S]*"invite_used",[\s\S]*INSERT INTO event_members[\s\S]*UPDATE event_member_invites SET accepted_at = \$\{SQL_NOW\}/);
  assert.match(acceptRoute, /if \(abortCode\(error\) === "invite_used"\) return invalid\(\)/);
});

test('mobile check-in is permission-gated, auditable, and reversible', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const route = await read('src/app/api/events/[eventId]/check-in/route.ts');
  const page = await read('src/app/(dashboard)/events/[eventId]/check-in/page.tsx');

  const guests = tableDefinition(schema, 'guests');
  assert.match(guests, /checked_in_at TIMESTAMP_TEXT/);
  assert.match(guests, /checked_in_by TEXT/);
  assert.match(guests, /FOREIGN KEY \(checked_in_by\) REFERENCES admin_users\(id\) ON DELETE SET NULL/);
  assert.match(route, /roleCan\([^,]+, ['"]check_in_guests['"]\)/);
  assert.match(route, /updateCheckInGuest/);
  const store = await read('src/lib/check-in-store.ts');
  assert.match(store, /UPDATE \$\{table\}[\s\S]*checked_in_at[\s\S]*RETURNING/);
  assert.match(store, /publicResponse \? 'rsvp_responses' : 'guests'/);
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
  const cron = await read('src/app/api/cron/send-announcements/route.ts');
  const dispatch = await read('src/lib/messages/dispatch-announcement.ts');
  const route = await read('src/app/api/events/[eventId]/announcements/route.ts');
  const cancel = await read('src/app/api/events/[eventId]/announcements/[announcementId]/route.ts');

  assert.match(tableDefinition(schema, 'announcement_deliveries'), /UNIQUE \(announcement_id, guest_id, channel\)/);
  assert.match(route, /approved[\s\S]*audience[\s\S]*scheduledAt/);
  assert.match(cancel, /status = 'cancelled'[\s\S]*status = 'queued'/);
  assert.match(cron, /Bearer \$\{cronSecret\}/);
  assert.match(cron, /dispatchAnnouncement/);
  assert.match(cron, /WHERE status = 'queued' AND approved_at IS NOT NULL AND scheduled_at <= \$\{SQL_NOW\}/);
  // Formerly FOR UPDATE SKIP LOCKED in the cron: each announcement is claimed by a batch whose guard
  // re-checks it is still queued and approved, so overlapping runs dispatch it once.
  assert.match(dispatch, /await batch\(\[\s*guard\(\s*`EXISTS \(SELECT 1 FROM event_announcements\s+WHERE id = \$1 AND status = 'queued' AND approved_at IS NOT NULL AND scheduled_at <= \$\{SQL_NOW\}\)`,\s*\[announcementId\],\s*"announcement_not_queued",\s*\),\s*\{ text: "UPDATE event_announcements SET status = 'processing'/);
  assert.match(dispatch, /if \(abortCode\(error\) === "announcement_not_queued"\) return \{ dispatched: false/);
  assert.match(dispatch, /ON CONFLICT \(announcement_id, guest_id, channel\) DO NOTHING/);
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
  const monitoring = await read('src/lib/monitoring/server-errors.ts');
  const instrumentation = await read('src/instrumentation.ts');
  const feedback = await read('src/app/api/feedback/route.ts');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS server_error_events/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS monitoring_alert_deliveries/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS beta_feedback/);
  // Error capture stores only a fingerprint and route metadata, never the message or stack.
  assert.doesNotMatch(tableDefinition(schema, 'server_error_events'), /message|stack/i);
  assert.doesNotMatch(monitoring, /error\.message|error\.stack/);
  assert.match(monitoring, /last_delivered_at/);
  assert.match(monitoring, /response\.ok/);
  assert.match(instrumentation, /onRequestError/);
  assert.match(feedback, /requireApiHost/);
  assert.match(feedback, /rateLimit/);
});

test('controlled beta evidence requires explicit consent, supports withdrawal, and records real milestones', async () => {
  const schema = await read('src/lib/db/schema.sql');
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

  // Only schema.sql now; the upgrade migration (which also withdrew out-of-scope legacy
  // participants) no longer exists, so that data step is not checked here.
  const participants = tableDefinition(schema, 'beta_participants');
  assert.ok(participants, 'beta_participants table definition is missing');
  assert.match(participants, /consent_version TEXT NOT NULL/);
  assert.match(participants, /consented_at TIMESTAMP_TEXT NOT NULL/);
  assert.match(participants, /withdrawn_at TIMESTAMP_TEXT/);
  for (const segment of ['club_association', 'volunteer_nonprofit', 'creative_community', 'alumni_professional', 'repeat_planner']) {
    assert.match(participants, new RegExp(`['"]${segment}['"]`));
  }
  for (const milestone of ['event_repeated', 'guest_import_completed', 'announcement_approved', 'calendar_exported', 'first_guest_checked_in']) {
    assert.match(tableDefinition(schema, 'activation_events'), new RegExp(`['"]${milestone}['"]`));
  }
  assert.match(route, /requireApiHost/);
  assert.match(route, /parseBetaEnrollment/);
  assert.match(route, /deriveBetaProgress/);
  assert.match(route, /SET withdrawn_at = \$\{SQL_NOW\}[\s\S]*WHERE user_id = \$1 AND withdrawn_at IS NULL/);
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
  const route = await read('src/app/api/beta/participation/route.ts');
  const panel = await read('src/components/dashboard/BetaParticipation.tsx');
  const command = await read('scripts/create-beta-invite.ts');
  const pkg = JSON.parse(await read('package.json'));

  assertColumns(schema, 'beta_enrollment_invites', ['token_hash', 'token_preview', 'participant_label', 'segment', 'expires_at', 'accepted_by', 'accepted_at', 'revoked_at']);
  assert.match(route, /hashMagicToken\(enrollment\.inviteToken\)/);
  assert.match(route, /accepted_at IS NULL/);
  assert.match(route, /revoked_at IS NULL/);
  assert.match(route, /expires_at > \$\{SQL_NOW\}/);
  assert.match(route, /Enter a valid invitation code and explicitly consent/);
  // Formerly BEGIN ... FOR UPDATE ... COMMIT: the enrollment batch guards that the invite is still
  // unused, unrevoked and unexpired, then records the participant and marks the invite accepted.
  assert.match(route, /await batch\(\[\s*guard\(\s*`EXISTS \(SELECT 1 FROM beta_enrollment_invites\s+WHERE id = \$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > \$\{SQL_NOW\} AND cohort_version = \$2\)`,[\s\S]*?"invite_used",/);
  assert.match(route, /accepted_by = \$2, accepted_at = \$\{SQL_NOW\}\s+WHERE id = \$1 AND accepted_at IS NULL/);
  assert.match(route, /if \(abortCode\(error\) === "invite_used"\) return noStore/);
  assert.doesNotMatch(route, /randomBytes/);
  assert.doesNotMatch(route, /enrollment\.segment/);
  assert.match(panel, /Invitation code/);
  assert.match(panel, /inviteToken/);
  assert.doesNotMatch(panel, /beta-segment/);
  assert.match(command, /generateMagicToken/);
  assert.match(command, /hashMagicToken/);
  assert.match(command, /previewMagicToken/);
  assert.match(command, /BETA_SEGMENTS/);
  assert.match(command, /strftime\('%Y-%m-%dT%H:%M:%fZ', 'now', '\+7 days'\)/);
  assert.equal(pkg.scripts['create-beta-invite'], 'npx tsx scripts/create-beta-invite.ts');
});

test('accepted beta invitations survive account deletion without retaining the account id', async () => {
  const schema = await read('src/lib/db/schema.sql');

  const invites = tableDefinition(schema, 'beta_enrollment_invites');
  assert.match(invites, /accepted_by TEXT,/);
  assert.match(invites, /FOREIGN KEY \(accepted_by\) REFERENCES admin_users\(id\) ON DELETE SET NULL/);
  assert.doesNotMatch(invites, /accepted_at IS NULL\)? OR \(?accepted_by IS NOT NULL/);

  // Behaviour: deleting the account keeps the accepted invite (so the code stays used) and clears the id.
  const db = await freshDb();
  seedUser(db);
  db.prepare("INSERT INTO beta_enrollment_invites (id, token_hash, token_preview, participant_label, segment, cohort_version, expires_at, accepted_by, accepted_at) VALUES ('inv-1', ?, 'abcd', 'host-0123456789ab', 'repeat_planner', 'beta-2026', '2030-01-01T00:00:00.000Z', 'user-1', '2026-01-01T00:00:00.000Z')").run('a'.repeat(64));
  db.prepare("DELETE FROM admin_users WHERE id = 'user-1'").run();
  const invite = db.prepare("SELECT accepted_by, accepted_at FROM beta_enrollment_invites WHERE id = 'inv-1'").get();
  assert.equal(invite.accepted_by, null);
  assert.equal(invite.accepted_at, '2026-01-01T00:00:00.000Z');
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
  assert.match(revokeCommand, /SET revoked_at = strftime\('%Y-%m-%dT%H:%M:%fZ', 'now'\)/);
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
  const route = await read('src/app/api/beta/outcome/route.ts');
  const panel = await read('src/components/dashboard/BetaOutcomeSurvey.tsx');
  const participation = await read('src/components/dashboard/BetaParticipation.tsx');
  const register = await read('docs/paid-beta-evidence-register.md');

  const outcomes = tableDefinition(schema, 'beta_outcomes');
  assert.ok(outcomes, 'beta_outcomes table definition is missing');
  assert.match(outcomes, /UNIQUE \(user_id, consented_at\)/);
  assert.match(outcomes, /self_reported_support_minutes INTEGER NOT NULL/);
  assert.match(outcomes, /CHECK \(\(\(self_reported_support_minutes >= 0\) AND \(self_reported_support_minutes <= 600\)\)\)/);
  assert.match(outcomes, /FOREIGN KEY \(user_id, consented_at\) REFERENCES beta_participants\(user_id, consented_at\) ON DELETE CASCADE/);
  assert.match(route, /requireApiHost/);
  assert.match(route, /withdrawn_at IS NULL/);
  assert.match(route, /segment IN \(SELECT value FROM json_each\(\$2\)\)/);
  // The consent is re-checked by a guard in the same batch as the upsert.
  assert.match(route, /guard\(\s*`EXISTS \(SELECT 1 FROM beta_participants\s+WHERE user_id = \$1 AND consented_at = \$2 AND withdrawn_at IS NULL\s+AND segment IN \(SELECT value FROM json_each\(\$3\)\)\)`,[\s\S]*?"consent_changed",\s*\),\s*\{\s*text: `INSERT INTO beta_outcomes/);
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
  const command = await read('scripts/record-beta-defect-review.ts');
  const report = await read('scripts/report-beta-participants.ts');
  const metrics = await read('src/app/api/operations/metrics/route.ts');
  const register = await read('docs/paid-beta-evidence-register.md');
  const pkg = JSON.parse(await read('package.json'));

  const reviews = tableDefinition(schema, 'beta_defect_reviews');
  assert.ok(reviews, 'beta_defect_reviews table definition is missing');
  assert.match(reviews, /UNIQUE \(user_id, consented_at\)/);
  assert.match(reviews, /unresolved_severity_1 INTEGER NOT NULL/);
  assert.match(reviews, /unresolved_severity_2 INTEGER NOT NULL/);
  assert.match(reviews, /CHECK \(\(\(unresolved_severity_1 >= 0\) AND \(unresolved_severity_1 <= 100\)\)\)/);
  assert.match(reviews, /CHECK \(\(\(unresolved_severity_2 >= 0\) AND \(unresolved_severity_2 <= 100\)\)\)/);
  assert.doesNotMatch(schema, /defect_(?:message|notes|description)/);
  assert.match(schema, /UNIQUE INDEX IF NOT EXISTS idx_beta_participants_user_consent/);
  assert.match(reviews, /FOREIGN KEY \(user_id, consented_at\) REFERENCES beta_participants\(user_id, consented_at\) ON DELETE CASCADE/);
  assert.match(command, /parseBetaDefectReview/);
  // Formerly lock-then-upsert: one INSERT ... SELECT FROM beta_participants (scoped to the approved
  // segments) ... ON CONFLICT ... RETURNING is atomic; no row back means no current participant.
  assert.match(command, /INSERT INTO beta_defect_reviews[\s\S]*SELECT user_id, consented_at,[\s\S]*FROM beta_participants\s+WHERE participant_label = \$1\s+AND segment IN \(SELECT value FROM json_each\(\$2\)\)\s+ON CONFLICT \(user_id, consented_at\) DO UPDATE SET[\s\S]*RETURNING reviewed_at/);
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
  const command = await read('scripts/record-beta-support-review.ts');
  const report = await read('scripts/report-beta-participants.ts');
  const metrics = await read('src/app/api/operations/metrics/route.ts');
  const register = await read('docs/paid-beta-evidence-register.md');
  const pkg = JSON.parse(await read('package.json'));

  const reviews = tableDefinition(schema, 'beta_support_reviews');
  assert.ok(reviews, 'beta_support_reviews table definition is missing');
  assert.match(reviews, /UNIQUE \(user_id, consented_at\)/);
  assert.match(reviews, /operator_recorded_support_minutes INTEGER NOT NULL/);
  assert.match(reviews, /CHECK \(\(\(operator_recorded_support_minutes >= 0\) AND \(operator_recorded_support_minutes <= 600\)\)\)/);
  assert.doesNotMatch(schema, /support_(?:message|notes|description)/);
  assert.match(reviews, /FOREIGN KEY \(user_id, consented_at\) REFERENCES beta_participants\(user_id, consented_at\) ON DELETE CASCADE/);
  assert.match(command, /parseBetaSupportReview/);
  // Formerly lock-then-upsert: one atomic INSERT ... SELECT FROM beta_participants ... ON CONFLICT ... RETURNING.
  assert.match(command, /INSERT INTO beta_support_reviews[\s\S]*SELECT user_id, consented_at,[\s\S]*FROM beta_participants\s+WHERE participant_label = \$1\s+AND segment IN \(SELECT value FROM json_each\(\$2\)\)\s+ON CONFLICT \(user_id, consented_at\) DO UPDATE SET[\s\S]*RETURNING reviewed_at/);
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
  const createInvite = await read('scripts/create-beta-invite.ts');
  const listInvites = await read('scripts/list-beta-invites.ts');
  const participation = await read('src/app/api/beta/participation/route.ts');
  const metrics = await read('src/app/api/operations/metrics/route.ts');
  const report = await read('scripts/report-beta-participants.ts');
  const featureSchemaVerification = await read('scripts/test/verify-feature-schema.sql');
  const operations = await read('docs/launch-operations.md');

  assert.match(tableDefinition(schema, 'beta_enrollment_invites'), /cohort_version TEXT NOT NULL/);
  assert.match(tableDefinition(schema, 'beta_participants'), /cohort_version TEXT NOT NULL/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_participants_active_cohort_segment ON beta_participants \(cohort_version, segment\) WHERE \(\(withdrawn_at IS NULL\) AND \(cohort_version <> 'legacy-unassigned'\)\)/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_invites_open_cohort_segment/);

  // Behaviour: one active host per segment in a cohort; a withdrawn host frees the seat.
  const db = await freshDb();
  for (const id of ['user-1', 'user-2']) seedUser(db, id);
  const enroll = db.prepare("INSERT INTO beta_participants (user_id, participant_label, segment, cohort_version, consent_version) VALUES (?, ?, 'repeat_planner', 'beta-2026', 'v1')");
  enroll.run('user-1', 'host-000000000001');
  rejectsConstraint(() => enroll.run('user-2', 'host-000000000002'), 'a second active host in the same segment is rejected');
  db.prepare("UPDATE beta_participants SET withdrawn_at = '2026-01-01T00:00:00.000Z' WHERE user_id = 'user-1'").run();
  enroll.run('user-2', 'host-000000000002');
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
  const uploader = await read('src/components/events/builder/screens/LookScreen.tsx');
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
  // Formerly BEGIN/DELETE/INSERT/COMMIT: the delete and the re-inserts run in one atomic batch.
  assert.match(fieldsRoute, /const statements: Statement\[\] = \[\s*\{ text: 'DELETE FROM rsvp_fields WHERE event_id = \$1', params: \[eventId\] \},/);
  assert.match(fieldsRoute, /INSERT INTO rsvp_fields/);
  assert.match(fieldsRoute, /f\.options \? JSON\.stringify\(f\.options\) : null/);
  assert.match(fieldsRoute, /const results = await batch\(statements\)/);
  assert.doesNotMatch(fieldsRoute, /client\.query\('BEGIN'\)/);
});

test('event checkout verifies ownership before exposing billing configuration', async () => {
  const route = await read('src/app/api/checkout/route.ts');
  const ownershipIndex = route.indexOf("SELECT id, title, tier FROM events WHERE id = $1 AND user_id = $2");
  const billingIndex = route.indexOf('if (!isStripeKeyAllowed())');
  assert.ok(ownershipIndex >= 0);
  assert.ok(billingIndex > ownershipIndex);
});

test('check-in keeps the first staff actor and clears it when undone', async () => {
  // Formerly asserted the Postgres-only `$4::uuid` cast in the CASE. SQLite needs no cast; the
  // property that matters (first actor kept, cleared on undo) is now exercised against schema.sql.
  const store = await read('src/lib/check-in-store.ts');
  assert.match(store, /checked_in_by = CASE WHEN \$3 THEN COALESCE\(checked_in_by, \$4\) ELSE NULL END/);

  const { updateCheckInGuestStatement } = await import('../src/lib/check-in-store.ts');
  const { toSqlite, encodeParams } = await import('../src/lib/db/sqlite-dialect.ts');
  const db = await freshDb();
  for (const id of ['owner', 'staff-1', 'staff-2']) seedUser(db, id);
  seedEvent(db, 'event-1', 'owner');
  const guestId = '11111111-1111-4111-8111-111111111111';
  db.prepare("INSERT INTO guests (id, event_id, name) VALUES (?, 'event-1', 'Guest')").run(guestId);
  const run = (actor, checkedIn) => {
    const { text, params } = updateCheckInGuestStatement('event-1', actor, { guestId, checkedIn });
    return db.prepare(toSqlite(text)).get(...encodeParams(params));
  };
  assert.ok(run('staff-1', true).checked_in_at);
  run('staff-2', true);
  assert.equal(db.prepare('SELECT checked_in_by FROM guests WHERE id = ?').get(guestId).checked_in_by, 'staff-1');
  assert.equal(run('staff-2', false).checked_in_at, null);
  assert.equal(db.prepare('SELECT checked_in_by FROM guests WHERE id = ?').get(guestId).checked_in_by, null);
});

test('published retention and deletion terms match the support-request workflow', async () => {
  const terms = await read('src/app/(marketing)/terms/page.tsx');
  const privacy = await read('src/app/(marketing)/privacy/page.tsx');
  for (const policy of [terms, privacy]) {
    assert.match(policy, /deletion request/i);
    assert.match(policy, /ask(?:ed)? (?:us )?to delete your account/i);
    assert.match(policy, /within 7 days/i);
    assert.match(policy, /law/i);
  }
});

test('verified account deletion is cancellable, subscription-safe, and executed by authenticated maintenance', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const route = await read('src/app/api/account/deletion/route.ts');
  const cron = await read('src/app/api/cron/delete-accounts/route.ts');
  const settings = await read('src/app/(dashboard)/settings/page.tsx');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS account_deletion_requests/);
  assert.match(route, /requireApiHost/);
  assert.match(route, /VALUES \(\$1, 'pending', \$\{SQL_NOW\}, \$\{sqlNowPlus\("\+7 days"\)\}/);
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
  const upload = await read('src/lib/upload-store.ts');
  const uploadRoute = await read('src/app/api/upload/route.ts');
  const drafts = await read('src/app/api/cron/cleanup-drafts/route.ts');
  const uploads = await read('src/app/api/cron/cleanup-uploads/route.ts');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS upload_assets/);
  // Formerly an advisory lock: the quota is re-checked inside the insert itself, and no row back
  // (a concurrent upload used the space) deletes the stored blob and reports the quota error.
  assert.match(upload, /INSERT INTO upload_assets \(user_id, path, byte_size, media_type\)\s+SELECT \$1, \$2, \$3, \$4\s+WHERE \(SELECT COALESCE\(SUM\(byte_size\), 0\) FROM upload_assets WHERE user_id = \$1\) \+ \$3 <= \$5\s+RETURNING id/);
  assert.match(upload, /if \(inserted\.length === 0\) \{\s*await store\.delete\(blobKey\)[\s\S]*?return \{ error: 'quota'/);
  assert.match(upload, /canReserveStorage/);
  assert.match(uploadRoute, /Storage quota exceeded/);
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
  const notifications = tableDefinition(schema, 'host_lifecycle_notifications');
  assert.match(notifications, /scope_key TEXT NOT NULL/);
  assert.match(notifications, /UNIQUE \(scope_key\)/);
  assert.match(route, /ENABLE_HOST_LIFECYCLE_EMAILS/);
  assert.match(route, /sendEmail/);
  assert.match(route, /ON CONFLICT \(scope_key\) DO NOTHING/);
  assert.match(example, /ENABLE_HOST_LIFECYCLE_EMAILS=false/);
});

test('post-event repeat prompts are bounded, deduplicated, and measurable', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const route = await read('src/app/api/cron/send-host-lifecycle/route.ts');
  const lifecycle = await read('src/lib/host-lifecycle.ts');
  const metrics = await read('src/app/api/operations/metrics/route.ts');

  assert.match(schema, /host_lifecycle_notifications_notification_type_check/);
  assert.match(schema, /post_event_repeat/);
  assert.match(lifecycle, /notification_type: [^;]*post_event_repeat/);
  assert.match(route, /COALESCE\(e\.event_end_date, e\.event_date\) <= \$\{sqlNowPlus\("-24 hours"\)\}/);
  assert.match(route, /COALESCE\(e\.event_end_date, e\.event_date\) >= \$\{sqlNowPlus\("-7 days"\)\}/);
  assert.match(route, /EXISTS \(SELECT 1 FROM rsvp_responses/);
  assert.match(route, /repeated\.repeated_from_event_id = e\.id/);
  assert.match(lifecycle, /Review outcomes/);
  assert.match(lifecycle, /Repeat event/);
  assert.match(metrics, /repeatLoop/);
  assert.match(metrics, /post_event_repeat/);
  assert.match(metrics, /repeated_from_event_id/);
});

test('stale-draft warnings cover the complete 14-day pre-cleanup window', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const route = await read('src/app/api/cron/send-host-lifecycle/route.ts');
  const lifecycle = await read('src/lib/host-lifecycle.ts');
  const privacy = await read('src/app/(marketing)/privacy/page.tsx');

  assert.match(schema, /stale_draft_warning/);
  assert.match(lifecycle, /stale_draft_warning/);
  assert.match(route, /STALE_DRAFT_RETENTION_DAYS/);
  assert.match(route, /STALE_DRAFT_WARNING_DAYS/);
  // The window bounds are now computed in JS and bound as ISO instants (formerly NOW() - n days in SQL):
  // drafts last updated between the retention cutoff and the warning age are warned.
  assert.match(route, /const warnFrom = new Date\(Date\.now\(\) - warningAgeDays \* day\)/);
  assert.match(route, /const retentionCutoff = new Date\(Date\.now\(\) - retentionDays \* day\)/);
  assert.match(route, /e\.updated_at <= \$1\s+AND e\.updated_at > \$3/);
  assert.match(route, /\[warnFrom, retentionDays, retentionCutoff\]/);
  // The scope key keeps the Postgres EXTRACT(EPOCH ...)::bigint rounding so pre-D1 warnings still match.
  assert.match(route, /CAST\(round\(unixepoch\(e\.updated_at, 'subsec'\)\) AS INTEGER\)/);
  assert.match(route, /strftime\('%Y-%m-%dT%H:%M:%fZ', e\.updated_at, '\+' \|\| \$2 \|\| ' days'\) AS action_at/);
  const db = await freshDb();
  assert.equal(db.prepare("SELECT CAST(round(unixepoch('2026-01-01T00:00:00.600Z', 'subsec')) AS INTEGER) AS epoch").get().epoch, 1767225601);
  assert.equal(db.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', '2026-01-01T00:00:00.600Z', '+' || 14 || ' days') AS at").get().at, '2026-01-15T00:00:00.600Z');
  assert.match(privacy, /90 days after (?:its|the) last update/i);
  assert.match(privacy, /14-day warning/i);
  assert.match(privacy, /unreferenced upload[^.]*7 days/i);
  assert.match(privacy, /automatic cleanup is currently disabled/i);
});

test('stale-draft deletion requires the current warning and its full waiting period', async () => {
  const cleanup = await read('src/app/api/cron/cleanup-drafts/route.ts');

  assert.match(cleanup, /resolveStaleDraftPolicy/);
  assert.match(cleanup, /notification_type = ['"]stale_draft_warning['"]/);
  // Same scope-key epoch as the warning sender (formerly EXTRACT(EPOCH ...)::bigint in both).
  assert.match(cleanup, /notifications\.scope_key = 'stale_draft_warning:' \|\| events\.id \|\| ':' \|\|\s+CAST\(round\(unixepoch\(events\.updated_at, 'subsec'\)\) AS INTEGER\) \|\| ':' \|\| \$4/);
  assert.match(cleanup, /notifications\.sent_at <= \$3/);
  assert.match(cleanup, /blockedWithoutWarning/);
  assert.match(cleanup, /DELETE FROM events[\s\S]*EXISTS[\s\S]*stale_draft_warning/);
});

test('retention rehearsal proves fail-closed deletion in disposable PostgreSQL', async () => {
  const rehearsal = await read('ops/rehearse-retention.sh');

  assert.match(rehearsal, /SEALSEND_RETENTION_REHEARSAL_CONFIRM/);
  assert.match(rehearsal, /date -u \+%Y%m%d%H%M%S/);
  assert.match(rehearsal, /postgres:16-alpine/);
  assert.match(rehearsal, /docker network create/);
  assert.match(rehearsal, /src\/lib\/db\/schema\.sql/);
  assert.match(rehearsal, /stale_draft_warning/);
  assert.match(rehearsal, /ENABLE_STALE_DRAFT_CLEANUP=true/);
  assert.match(rehearsal, /"candidates":4/);
  assert.match(rehearsal, /"warnedCandidates":1/);
  assert.match(rehearsal, /"blockedWithoutWarning":3/);
  assert.match(rehearsal, /"deleted":1/);
  assert.match(rehearsal, /remaining_events.*3/);
  assert.match(rehearsal, /trap cleanup EXIT INT TERM/);
  assert.doesNotMatch(rehearsal, /sealsend-postgres|coolify\.resourceName|--network host/);
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

test('paid-mode analytics uses server-derived event-owner entitlements', async () => {
  const page = await read('src/app/(dashboard)/events/[eventId]/analytics/page.tsx');
  const route = await read('src/app/api/events/[eventId]/features/route.ts').catch(() => '');

  assert.match(page, /\/api\/events\/\$\{eventId\}\/features/);
  assert.doesNotMatch(page, /currentTier=["']free["']/);
  assert.match(page, /requiredTier=["']business["']/);
  assert.match(page, /currentTier=\{hasAnalyticsAccess \? ["']business["'] : ["']free["']\}/);
  assert.match(route, /requireEventPermission\(eventId, ["']export_responses["']\)/);
  assert.match(route, /getUserTier\(event\.user_id\)/);
  assert.match(route, /canUseFeature\(accountPlan, event\.tier as EventTier, ["']analytics["']\)/);
});

test('direct provider test sends obey the controlled-recipient allowlist', async () => {
  const smsTest = await read('scripts/test/test-sms.ts');
  const guardIndex = smsTest.indexOf('assertApprovedRecipient(formattedPhone)');
  const sendIndex = smsTest.indexOf('client.messages.create');

  assert.ok(guardIndex >= 0, 'SMS provider test must enforce the controlled-recipient allowlist');
  assert.ok(sendIndex > guardIndex, 'SMS recipient guard must run before the first provider send');
});

test('Twilio incoming opt-out events synchronize the local SMS suppression state', async () => {
  const twilio = await read('src/app/api/webhooks/twilio/route.ts');
  const inbound = await read('src/lib/twilio-inbound-opt-out.ts');

  assert.match(twilio, /processTwilioOptOutEvent/);
  assert.match(twilio, /data\.OptOutType/);
  assert.match(twilio, /data\.From/);
  assert.match(twilio, /BEGIN[\s\S]*processTwilioOptOutEvent[\s\S]*COMMIT/);
  assert.match(twilio, /<Response><\/Response>/);
  // The lib now builds its own batch: a duplicate-receipt guard, the receipt, then the suppression
  // changes, so a failure leaves no receipt and a replay (even a racing one) is a no-op.
  assert.match(inbound, /START[\s\S]*removeCommunicationSuppressionsStatement/);
  assert.match(inbound, /STOP[\s\S]*communicationSuppressionStatement\(\{[\s\S]*reason: "unsubscribed"/);
  assert.match(inbound, /HELP/);
  assert.match(inbound, /await db\.batch\(\[\s*guard\(\s*"NOT EXISTS \(SELECT 1 FROM webhook_receipts WHERE provider = 'twilio' AND event_id = \$1\)",\s*\[receiptId\],\s*"duplicate_receipt",\s*\),\s*\{ text: "INSERT INTO webhook_receipts \(provider, event_id\) VALUES \('twilio', \$1\)", params: \[receiptId\] \},\s*\.\.\.changes,/);
  assert.match(inbound, /if \(abortCode\(error\) === "duplicate_receipt"\)/);
  assert.match(inbound, /JOIN events/);
});

test('complaints, unsubscribes, bounces, and invalid phones block future guest communications', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const mailgun = await read('src/app/api/webhooks/mailgun/route.ts');
  const invitations = await read('src/app/api/events/[eventId]/send-invites/route.ts');
  const reminders = await read('src/app/api/events/[eventId]/send-reminders/route.ts');
  const scheduledReminders = await read('src/app/api/cron/send-reminders/route.ts');
  const announcements = await read('src/lib/messages/dispatch-announcement.ts');
  const guestUpdate = await read('src/app/api/events/[eventId]/guests/[guestId]/route.ts');

  const suppressions = tableDefinition(schema, 'communication_suppressions');
  assert.ok(suppressions, 'communication_suppressions table definition is missing');
  assert.match(suppressions, /recipient_hash TEXT NOT NULL/);
  assert.match(suppressions, /PRIMARY KEY \(user_id, channel, recipient_hash\)/);
  // Only hashes are stored: anything that isn't 64 lowercase hex characters is rejected.
  const db = await freshDb();
  seedUser(db);
  const suppress = db.prepare("INSERT INTO communication_suppressions (user_id, channel, recipient_hash, reason, provider) VALUES ('user-1', 'sms', ?, 'unsubscribed', 'twilio')");
  suppress.run('a'.repeat(64));
  rejectsConstraint(() => suppress.run('a'.repeat(64)), 'one suppression per owner, channel and recipient');
  rejectsConstraint(() => suppress.run('+15551234567'), 'raw phone numbers are never stored');
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
    assert.match(sender, /SET phone_invalid_at = \$\{SQL_NOW\}/);
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
  assert.match(operatorScript, /coolify\.resourceName=\$resource/);
  assert.match(operatorScript, /for resource in sealsend seal-send/);
  assert.match(operatorScript, /Authorization: Bearer \$OPERATIONS_SECRET/);
  assert.match(operatorScript, /api\/operations\/readiness/);
  assert.doesNotMatch(operatorScript, /echo.*OPERATIONS_SECRET|set -x/);
});

test('authentication codes are hashed and scoped to one login context', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const send = await read('src/app/api/auth/send-code/route.ts');
  const verify = await read('src/app/api/auth/verify-code/route.ts');
  const password = await read('src/app/api/auth/login-password/route.ts');
  const authCodes = tableDefinition(schema, 'auth_codes');
  assert.match(authCodes, /code_hash TEXT NOT NULL/);
  assert.doesNotMatch(authCodes, /\n\s*code TEXT/);
  // SQLite (3.39+) evaluates IS NOT DISTINCT FROM, so a NULL event_id scopes host logins correctly.
  const db = await freshDb();
  const scoped = db.prepare('SELECT (NULL IS NOT DISTINCT FROM NULL) AS same, (NULL IS NOT DISTINCT FROM ?) AS differs').get('event-1');
  assert.equal(scoped.same, 1);
  assert.equal(scoped.differs, 0);
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

test('organizer plan checkout is owner-only, beta-gated, and synced from verified Stripe webhooks', async () => {
  const schema = await read('src/lib/db/schema.sql');
  const route = await read('src/app/api/organizations/[organizationId]/billing/checkout/route.ts');
  const webhook = await read('src/app/api/webhooks/stripe/route.ts');
  const envExample = await read('.env.example');

  assertColumns(schema, 'organization_subscriptions', ['organization_id', 'stripe_customer_id', 'stripe_subscription_id', 'plan', 'status', 'current_period_end', 'cancel_at_period_end']);
  const subscriptions = tableDefinition(schema, 'organization_subscriptions');
  assert.match(subscriptions, /organization_id TEXT PRIMARY KEY,/);
  assert.match(subscriptions, /FOREIGN KEY \(organization_id\) REFERENCES organizations\(id\) ON DELETE CASCADE/);
  assert.match(subscriptions, /plan TEXT NOT NULL,/);
  assert.match(subscriptions, /CHECK \(\(plan IN \('solo', 'studio', 'agency'\)\)\)/);

  assert.match(route, /auth\.role !== "owner"/);
  assert.match(route, /if \(BETA_MODE\)/);
  assert.match(route, /isOrganizerCheckoutAvailable/);
  assert.match(route, /organization\.is_personal/);
  assert.match(route, /rateLimit\(`org-checkout:/);

  assert.match(webhook, /metadata\?\.kind === "organizer_plan"/);
  assert.match(webhook, /INSERT INTO organization_subscriptions/);
  assert.match(webhook, /UPDATE organizations SET plan = \$1/);
  assert.match(webhook, /PAYMENTS_TEST_ONLY === "true" && event\.livemode/);

  for (const name of ['SOLO', 'STUDIO', 'AGENCY']) {
    assert.match(envExample, new RegExp(`^STRIPE_ORGANIZER_${name}_PRICE_ID=`, 'm'));
  }
});

test('organizer plan changes and cancellations are owner-only, beta-gated, and applied only by the webhook', async () => {
  const route = await read('src/app/api/organizations/[organizationId]/billing/subscription/route.ts');
  const webhook = await read('src/app/api/webhooks/stripe/route.ts');
  const schema = await read('src/lib/db/schema.sql');

  assert.match(route, /auth\.role !== "owner"/);
  assert.match(route, /if \(BETA_MODE\)/);
  assert.match(route, /isStripeKeyAllowed\(\)/);
  assert.match(route, /rateLimit\(`org-billing:/);
  assert.match(route, /changeOrganizerSubscriptionPlan/);
  assert.match(route, /setOrganizerSubscriptionCancellation/);
  // The route asks Stripe; only the signed webhook writes the plan.
  assert.doesNotMatch(route, /UPDATE organizations/);
  assert.doesNotMatch(route, /organization_subscriptions SET/);

  // Plan comes from the billed price, period end and invoice links read the current API shape.
  assert.match(webhook, /organizerPlanFromSubscription\(subscription\)/);
  assert.match(webhook, /subscriptionPeriodEnd\(subscription\)/);
  assert.match(webhook, /invoiceSubscriptionId\(invoice\)/);
  assert.doesNotMatch(webhook, /as unknown as \{ current_period_end/);
  // A late event for an older subscription can't overwrite the current one.
  assert.match(webhook, /WHERE organization_subscriptions\.stripe_subscription_id = EXCLUDED\.stripe_subscription_id\s+OR organization_subscriptions\.status = 'canceled'/);
  assert.match(webhook, /if \(stored\.rowCount\)/);

  // Formerly the upgrade migration's ADD COLUMN; now part of the one schema.
  assert.match(tableDefinition(schema, 'organization_subscriptions'), /cancel_at_period_end BOOLEAN NOT NULL DEFAULT 0,/);
});

test('the Stripe test-mode end-to-end run refuses live keys and non-local databases', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const script = await read('scripts/stripe/test-e2e.ts');

  assert.equal(pkg.scripts['stripe:test-e2e'], 'tsx scripts/stripe/test-e2e.ts');
  assert.match(script, /assertStripeTestKey\(process\.env\.STRIPE_SECRET_KEY\)/);
  assert.match(script, /process\.env\.PAYMENTS_TEST_ONLY = "true"/);
  assert.match(script, /livemode/);
  assert.match(script, /STRIPE_E2E_ALLOW_REMOTE_DB/);
  assert.doesNotMatch(script, /sk_live_[A-Za-z0-9]/);
});

test('Cloudflare cron triggers match the worker routes and the VPS jobs that are enabled', async () => {
  const config = await read('cloudflare.config.ts');
  const worker = await read('worker/index.ts');
  const schedules = [...config.matchAll(/triggers\.scheduled\(\{ schedule: "([^"]+)" \}\)/g)].map((match) => match[1]).sort();
  const routes = Object.fromEntries([...worker.matchAll(/"([^"]+)": "(\/api\/cron\/[a-z-]+)"/g)].map((match) => [match[1], match[2]]));
  assert.deepEqual(Object.keys(routes).sort(), schedules);
  for (const route of Object.values(routes)) await read(`src/app${route}/route.ts`);
  // Gated jobs (provider/retention gates in ops/sealsend-maintenance.cron) must not be scheduled by default.
  for (const gated of ['send-reminders', 'send-announcements', 'send-host-lifecycle', 'cleanup-drafts']) {
    assert.doesNotMatch(worker, new RegExp(`"/api/cron/${gated}"`));
  }
  assert.match(worker, /Authorization: `Bearer \$\{env\.CRON_SECRET\}`/);
});

test('every Workers platform twin exposes the same names as the Node module', async () => {
  // Node-only on purpose: the Workers transport has no dns module and checks DNS-over-HTTPS answers instead.
  const nodeOnly = new Set(['publicOnlyLookup']);
  const names = (text) => new Set([
    ...[...text.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map((match) => match[1]),
    ...[...text.matchAll(/export (?:type )?\{([^}]+)\}/g)].flatMap((match) => match[1].split(',').map((name) => name.trim().replace(/^type /, '')).filter(Boolean)),
  ]);
  for (const [node, twin] of [
    ['src/lib/blob-store.ts', 'src/lib/blob-store.cloudflare.ts'],
    ['src/lib/db/client.ts', 'src/lib/db/client.cloudflare.ts'],
    ['src/lib/image-processor.ts', 'src/lib/image-processor.cloudflare.ts'],
    ['src/lib/runtime-bindings.ts', 'src/lib/runtime-bindings.cloudflare.ts'],
    ['src/lib/webhook-transport.ts', 'src/lib/webhook-transport.cloudflare.ts'],
  ]) {
    const have = names(await read(twin));
    for (const name of names(await read(node))) {
      if (!nodeOnly.has(name)) assert.ok(have.has(name), `${twin} is missing ${name}`);
    }
  }
});

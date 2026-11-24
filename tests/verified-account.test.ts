import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

process.env.SQLITE_PATH = ":memory:";
process.env.SESSION_SECRET ??= "test-session-secret-for-local-unit-tests";
delete process.env.MAILGUN_API_KEY;
delete process.env.MAILGUN_DOMAIN;

const { exec, query, queryOne } = await import("../src/lib/db/client");
const { claimAccountByCode } = await import("../src/lib/auth/verified-account");
const { getInvitedEvents } = await import("../src/lib/events");
const signup = await import("../src/app/api/auth/signup-password/route");
const login = await import("../src/app/api/auth/login-password/route");
const sendCode = await import("../src/app/api/auth/send-code/route");
const { hashPassword } = await import("../src/lib/password");
await exec(readFileSync("src/lib/db/schema.sql", "utf8"));

const post = (handler: unknown, body: unknown) => (handler as (request: Request) => Promise<Response>)(
  new Request("https://sealsend.test/api", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }),
);
const one = async (sql: string, params: unknown[] = []) => Number((await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${sql}`, params))!.n);

async function user(email: string, password = "x", verified = false): Promise<string> {
  const row = await queryOne<{ id: string }>(
    "INSERT INTO admin_users (email, password, email_verified_at) VALUES ($1, $2, $3) RETURNING id",
    [email, password, verified ? new Date() : null],
  );
  return row!.id;
}

async function seedOwned(owner: string, other: string, key: string): Promise<{ event: string; org: string }> {
  const org = (await queryOne<{ id: string }>("INSERT INTO organizations (name, slug, created_by) VALUES ($1, $1, $2) RETURNING id", [key, owner]))!.id;
  const event = (await queryOne<{ id: string }>("INSERT INTO events (user_id, title, slug, organization_id) VALUES ($1, $2, $2, $3) RETURNING id", [owner, key, org]))!.id;
  const later = new Date(Date.now() + 86_400_000);
  await query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'admin')", [org, owner, other]);
  await query("INSERT INTO event_members (event_id, user_id, role, invited_by) VALUES ($1, $2, 'manager', $3)", [event, other, owner]);
  await query("INSERT INTO event_member_invites (event_id, email, role, token_hash, token_preview, invited_by, expires_at) VALUES ($1, 'x@example.test', 'viewer', $2, 'p', $3, $4)", [event, `em-${key}`, owner, later]);
  await query("INSERT INTO organization_invites (organization_id, email, role, token_hash, token_preview, invited_by, expires_at) VALUES ($1, 'x@example.test', 'planner', $2, 'p', $3, $4)", [org, `oi-${key}`, owner, later]);
  await query("INSERT INTO event_client_shares (event_id, token_hash, token_preview, created_by, expires_at) VALUES ($1, $2, 'p', $3, $4)", [event, `cs-${key}`, owner, later]);
  await query("INSERT INTO organization_webhooks (organization_id, url, secret, events, created_by) VALUES ($1, 'https://example.test/hook', 's', $2, $3)", [org, JSON.stringify(["rsvp.created"]), owner]);
  return { event, org };
}

test("proving an address removes every way back in for whoever registered it", async () => {
  const owner = await user("claimed@example.test", "attacker-hash");
  const accomplice = await user("accomplice@example.test");
  const { event, org } = await seedOwned(owner, accomplice, "squatted");
  await query("INSERT INTO user_sessions (user_id, user_role, session_token, expires_at) VALUES ($1, 'admin', 'attacker-session', $2)", [owner, new Date(Date.now() + 1e6)]);

  await claimAccountByCode(owner);

  const row = await queryOne<{ password: string; email_verified_at: string | null }>("SELECT password, email_verified_at FROM admin_users WHERE id = $1", [owner]);
  assert.notEqual(row!.password, "attacker-hash");
  assert.ok(row!.email_verified_at);
  assert.equal(await one("user_sessions WHERE user_id = $1", [owner]), 0);
  assert.equal(await one("event_members WHERE event_id = $1", [event]), 0);
  assert.equal(await one("event_member_invites WHERE event_id = $1", [event]), 0);
  assert.equal(await one("organization_invites WHERE organization_id = $1", [org]), 0);
  assert.equal(await one("event_client_shares WHERE event_id = $1 AND revoked_at IS NULL", [event]), 0);
  assert.equal(await one("organization_webhooks WHERE organization_id = $1 AND active", [org]), 0);
  assert.equal(await one("organization_members WHERE organization_id = $1 AND user_id = $2", [org, accomplice]), 0);
  assert.equal(await one("organization_members WHERE organization_id = $1 AND user_id = $2", [org, owner]), 1);
  assert.equal(await one("events WHERE id = $1", [event]), 1, "a genuine host keeps their events");
});

test("a verified account and other people's workspaces are left alone", async () => {
  const owner = await user("verified@example.test", "keep-me", true);
  const other = await user("unverified-owner@example.test");
  const { event, org } = await seedOwned(owner, other, "established");
  await query("UPDATE organization_members SET role = 'owner' WHERE organization_id = $1 AND user_id = $2", [org, other]);

  await claimAccountByCode(owner);
  await claimAccountByCode(other);

  assert.equal((await queryOne<{ password: string }>("SELECT password FROM admin_users WHERE id = $1", [owner]))!.password, "keep-me");
  assert.equal(await one("event_members WHERE event_id = $1", [event]), 1);
  assert.equal(await one("organization_members WHERE organization_id = $1", [org]), 2);
  assert.equal(await one("organization_webhooks WHERE organization_id = $1 AND active", [org]), 1);
});

test("only a verified host email reveals invitations", async () => {
  const host = await user("party-host@example.test", "x", true);
  const event = (await queryOne<{ id: string }>("INSERT INTO events (user_id, title, slug, status) VALUES ($1, 'Private party', 'private-party', 'published') RETURNING id", [host]))!.id;
  await query("INSERT INTO guests (event_id, name, email, phone) VALUES ($1, 'Guest', 'guest@example.test', '+14165550100')", [event]);
  const id = await user("guest@example.test");
  const account = { id, role: "admin" as const, email: "guest@example.test", phone: null };
  assert.deepEqual(await getInvitedEvents(account), []);
  await claimAccountByCode(id);
  assert.equal((await getInvitedEvents(account)).length, 1);
  assert.equal((await getInvitedEvents({ id: "guest", role: "guest", email: null, phone: "+14165550100" })).length, 1);
});

test("sign-up refuses phone-account addresses and weak passwords", async () => {
  assert.equal((await post(signup.POST, { email: "phone+14165550100@users.sealsend.local", password: "Str0ng-password!" })).status, 400);
  assert.equal((await post(signup.POST, { email: "weak@example.test", password: "aaaaaaaa" })).status, 400);
  assert.equal(await one("admin_users WHERE email IN ('weak@example.test', 'phone+14165550100@users.sealsend.local')"), 0);
});

test("an unverified password stops working once email codes can be delivered", async (t) => {
  await user("squatter@example.test", await hashPassword("Str0ng-password!"));
  process.env.MAILGUN_API_KEY = "test";
  process.env.MAILGUN_DOMAIN = "mg.example.test";
  t.after(() => { delete process.env.MAILGUN_API_KEY; delete process.env.MAILGUN_DOMAIN; });
  await query("DELETE FROM rate_limit_attempts");
  assert.equal((await post(login.POST, { email: "squatter@example.test", password: "Str0ng-password!" })).status, 403);
  assert.equal(await one("user_sessions s JOIN admin_users a ON a.id = s.user_id WHERE a.email = 'squatter@example.test'"), 0);
});

test("malformed sign-in bodies are rejected, not server errors", async () => {
  for (const body of ["not json", { email: {}, password: ["x"] }, "null"]) {
    await query("DELETE FROM rate_limit_attempts");
    assert.equal((await post(login.POST, body)).status, 400);
  }
});

test("one account has its own sign-in limit", async () => {
  await query("DELETE FROM rate_limit_attempts");
  for (let i = 0; i < 20; i++) await query("INSERT INTO rate_limit_attempts (key) VALUES ('login-password-account:target@example.test')");
  assert.equal((await post(login.POST, { email: "Target@example.test", password: "guess" })).status, 429);
});

test("code sign-in says email is off instead of failing to send", async () => {
  await query("DELETE FROM rate_limit_attempts");
  const response = await post(sendCode.POST, { method: "email", email: "a@example.test" });
  assert.equal(response.status, 400);
  assert.equal(await one("auth_codes"), 0);
});

test("the D1 migration adds the column and trusts only accounts from before password sign-up", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE admin_users (id TEXT, created_at TEXT); INSERT INTO admin_users VALUES ('old', '2026-10-01T00:00:00.000Z'), ('new', '2026-11-12T00:00:00.000Z')");
  db.exec(readFileSync("src/lib/db/migrations/2026-11-24-email-verified.sql", "utf8"));
  const rows = db.prepare("SELECT id, email_verified_at AS v FROM admin_users ORDER BY id").all() as { id: string; v: string | null }[];
  assert.equal(rows.find((r) => r.id === "new")!.v, null);
  assert.ok(rows.find((r) => r.id === "old")!.v);
});

test("signing in with a code claims an unverified account", async () => {
  const verify = await import("../src/app/api/auth/verify-code/route");
  const { hashAuthCode } = await import("../src/lib/auth/code-hash");
  const { withMobileContext } = await import("../src/lib/auth/mobile-context");
  const email = "code-claim@example.test";
  const id = await user(email, "attacker-hash");
  await query("INSERT INTO user_sessions (user_id, user_role, session_token, expires_at) VALUES ($1, 'admin', 'old-session', $2)", [id, new Date(Date.now() + 1e6)]);
  await query("INSERT INTO auth_codes (email, code_hash, role, expires_at) VALUES ($1, $2, 'admin', $3)", [
    email, hashAuthCode({ code: "123456", recipient: email, role: "admin" }), new Date(Date.now() + 1e6),
  ]);
  await query("DELETE FROM rate_limit_attempts");
  const response = await withMobileContext({ user: null, sessionToken: null }, () => post(verify.POST, { method: "email", email, code: "123456" }));
  assert.equal(response.status, 200);
  assert.equal(await one("user_sessions WHERE session_token = 'old-session'"), 0);
  assert.equal(await one("user_sessions WHERE user_id = $1", [id]), 1, "only the code holder's new session remains");
  assert.equal(await one("admin_users WHERE id = $1 AND password = 'attacker-hash'", [id]), 0);
});

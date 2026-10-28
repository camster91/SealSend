/** Isolated native-app HTTP checks. Throwaway synthetic SQLite database; never sends email. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open, mkdir, writeFile, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { startSocialQa } from './start-social-qa';
import { hashAuthCode } from '../../src/lib/auth/code-hash';

const origin = 'http://127.0.0.1:3130';
const secret = 'local-mobile-auth-code-secret-for-qa-only';
const cronSecret = 'local-mobile-deletion-cron-secret-for-qa-only';
process.env.SESSION_SECRET = secret;
const owner = '00000000-0000-4000-8000-000000000010';
const eventId = '00000000-0000-4000-8000-000000000011';
const guestId = '00000000-0000-4000-8000-000000000012';
async function main() {
const qa = await startSocialQa();
const log = await open('/tmp/sealsend-mobile-http.log', 'w');
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3130'], {
  stdio: ['ignore', log.fd, log.fd], env: { ...process.env, SQLITE_PATH: qa.db.path, SESSION_SECRET: secret, CRON_SECRET: cronSecret, ENABLE_NATIVE_MOBILE_API: 'true', COMMUNICATIONS_TEST_ONLY: 'true', PAYMENTS_TEST_ONLY: 'true', AI_PROVIDER: 'fake', NEXT_PUBLIC_SITE_URL: origin },
});
let checks = 0;
const deletionUser = randomUUID();
const deletionDirectory = join(process.cwd(), 'uploads', deletionUser);
let ownsDeletionDirectory = false;
async function request(path: string, status: number, token?: string, method = 'GET', body?: unknown, web = false, mutationKey?: string) {
  const response = await fetch(`${origin}/api/${web ? '' : 'mobile/v1/'}${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', DNT: '1', ...(!web && path === 'events' && method === 'POST' ? { 'Idempotency-Key': mutationKey || randomUUID() } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(response.status, status, `${method} ${path}`);
  if (!web) assert.match(response.headers.get('cache-control') || '', /no-store/);
  checks++;
  return response;
}
async function code(email: string, value: string) {
  await qa.db.query("INSERT INTO auth_codes(email,code_hash,role,expires_at) VALUES ($1,$2,'admin',strftime('%Y-%m-%dT%H:%M:%fZ','now','+15 minutes'))", [email, hashAuthCode({ code: value, recipient: email, role: 'admin' })]);
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { const r = await fetch(`${origin}/api/mobile/v1/me`); if (r.status === 401) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 300)); }
  assert.ok(ready, 'local API must start');
  await request('me', 401);
  await request('billing', 404);
  await request('auth/verify', 400, undefined, 'POST', { method: 'phone', phone: '+15555555555', code: '123456' });
  await request('auth/verify', 400, undefined, 'POST', { method: 'email', email: 'guest@example.test', eventId, code: '123456' });
  await code('builder-qa@example.test', '123456');
  const login = await request('auth/verify', 200, undefined, 'POST', { method: 'email', email: 'builder-qa@example.test', code: '123456' });
  assert.equal(login.headers.get('set-cookie'), null, 'native auth must not set cookies');
  const session = await login.json();
  assert.match(session.sessionToken, /^[0-9a-f-]{36}$/);
  const token = session.sessionToken;
  await request('me', 200, token);
  await request(`events/${eventId}`, 404, token);
  await request(`events/${eventId}/check-in`, 404, token);
  await request('auth/verify', 401, undefined, 'POST', { method: 'email', email: 'builder-qa@example.test', code: '123456' });
  const createKey = randomUUID();
  const draft = { title: 'Native QA gathering', location_name: 'QA Hall', event_date: new Date(Date.now()+86400000).toISOString(), event_timezone: 'America/Toronto', status: 'draft' };
  const created = await (await request('events', 201, token, 'POST', draft, false, createKey)).json();
  const recovered = await (await request('events', 200, token, 'POST', draft, false, createKey)).json();
  assert.equal(recovered.id, created.id); checks++;
  await request('events', 409, token, 'POST', { ...draft, title: 'Conflicting details' }, false, createKey);
  await request(`events/${created.id}`, 200, token, 'PATCH', { status: 'published' });
  await request(`events/${created.id}`, 200, token, 'PATCH', { title: 'Edited Native QA gathering' });
  await request('events', 403, token, 'POST', { title: 'Over quota' });
  await request(`events/${created.id}`, 200, token, 'PATCH', { status: 'archived' });
  await request(`events/${created.id}`, 409, token, 'PATCH', { status: 'published' });
  const ownerToken = randomUUID();
  await qa.db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'admin',$2,strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day'))", [owner, ownerToken]);
  await request(`events/${eventId}/check-in`, 200, ownerToken);
  const arrival = await (await request(`events/${eventId}/check-in`, 200, ownerToken, 'PATCH', { inviteToken: 'a'.repeat(24), checkedIn: true })).json();
  assert.equal(arrival.id, guestId); assert.ok(arrival.checked_in_at);
  const repeatedArrival = await (await request(`events/${eventId}/check-in`, 200, ownerToken, 'PATCH', { guestId, checkedIn: true })).json();
  assert.equal(repeatedArrival.checked_in_at, arrival.checked_in_at, 'retries preserve arrival time');
  const audit = await qa.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM event_audit_log WHERE event_id = $1 AND action = 'guest_checked_in'", [eventId]);
  assert.equal(audit.rows[0].count, 1, 'retries must not duplicate arrival side effects');
  checks += 2;
  await request(`events/${eventId}/check-in`, 200, ownerToken, 'PATCH', { guestId, checkedIn: false });
  const guestToken = randomUUID();
  await qa.db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'guest',$2,strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day'))", [guestId, guestToken]);
  await request('me', 403, guestToken);
  const deletion = await (await request('account/deletion', 202, token, 'POST')).json();
  const repeatedDeletion = await (await request('account/deletion', 202, token, 'POST')).json();
  assert.equal(repeatedDeletion.request.scheduled_for, deletion.request.scheduled_for); checks++;
  await request('account/deletion', 200, token, 'GET');
  await request('account/deletion', 200, token, 'DELETE');
  await request('session', 200, token, 'DELETE');
  await request('me', 401, token);
  await qa.db.query("UPDATE user_sessions SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day') WHERE session_token = $1", [ownerToken]);
  await request('me', 401, ownerToken);
  const orphanToken = randomUUID();
  await qa.db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'admin',$2,strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day'))", [randomUUID(), orphanToken]);
  await request('me', 401, orphanToken);
  await code('builder-qa@example.test', '654321');
  const webLogin = await request('auth/verify-code', 200, undefined, 'POST', { method: 'email', email: 'builder-qa@example.test', code: '654321' }, true);
  assert.match(webLogin.headers.get('set-cookie') || '', /sealsend_session=/);
  assert.equal((await webLogin.json()).sessionToken, undefined, 'web auth must not expose bearer');
  const webBearer = await request('events', 401, ownerToken, 'GET', undefined, true);
  assert.equal(webBearer.status, 401, 'web API must not authenticate bearer');
  const csrf = await fetch(`${origin}/api/mobile/v1/events`, { method: 'POST', headers: { Origin: 'https://evil.test', Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(csrf.status, 403); checks++;
  await code('builder-qa@example.test', '789012');
  const simultaneous = await Promise.all([0, 1].map(() => fetch(`${origin}/api/mobile/v1/auth/verify`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', DNT: '1' }, body: JSON.stringify({ method: 'email', email: 'builder-qa@example.test', code: '789012' }) })));
  assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 401], 'concurrent OTP verification must only mint one session');
  await Promise.all(simultaneous.map(r => r.arrayBuffer())); checks += 2;

  // Execute the real processor only against freshly fabricated users in this throwaway database.
  const futureUser = randomUUID(), cancelledUser = randomUUID(), paidUser = randomUUID();
  const deletionToken = randomUUID();
  for (const userId of [deletionUser, futureUser, cancelledUser, paidUser]) {
    await qa.db.query('INSERT INTO admin_users(id,email,password) VALUES ($1,$2,$3)', [userId, `${userId}@example.test`, 'unused-local-fixture-password']);
  }
  await qa.db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'admin',$2,strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day'))", [deletionUser, deletionToken]);
  const deletionEvent = await (await request('events', 201, deletionToken, 'POST', { ...draft, title: 'Disposable deletion QA' }, false, randomUUID())).json();
  const inheritedOrg = randomUUID(), coownedOrg = randomUUID(), orphanOrg = randomUUID();
  const inheritedEvent = randomUUID(), coownedEvent = randomUUID(), survivingEvent = randomUUID();
  for (const orgId of [inheritedOrg, coownedOrg, orphanOrg]) {
    await qa.db.query("INSERT INTO organizations(id,name,slug,is_personal,created_by) VALUES ($1,'Deletion workspace QA',$2,false,$3)", [orgId, `deletion-${orgId}`, deletionUser]);
    await qa.db.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner')", [orgId, deletionUser]);
  }
  await qa.db.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'admin'),($3,$4,'owner'),($5,$2,'check_in')", [inheritedOrg, futureUser, coownedOrg, cancelledUser, orphanOrg]);
  for (const [id, userId, orgId] of [[inheritedEvent, deletionUser, inheritedOrg], [coownedEvent, deletionUser, coownedOrg], [survivingEvent, futureUser, orphanOrg]]) {
    await qa.db.query("INSERT INTO events(id,user_id,organization_id,title,slug,status) VALUES ($1,$2,$3,'Shared deletion QA',$4,'draft')", [id, userId, orgId, `deletion-${id}`]);
  }
  await request('account/deletion', 202, deletionToken, 'POST');
  await qa.db.query("UPDATE account_deletion_requests SET scheduled_for=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 minute') WHERE user_id=$1", [deletionUser]);
  await qa.db.query("INSERT INTO account_deletion_requests(user_id,status,scheduled_for) VALUES ($1,'pending',strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day')),($2,'cancelled',strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')),($3,'pending',strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day'))", [futureUser, cancelledUser, paidUser]);
  await qa.db.query("INSERT INTO user_subscriptions(user_id,tier,status) VALUES ($1,'pro_annual','active')", [paidUser]);
  await mkdir(join(process.cwd(), 'uploads'), { recursive: true });
  await mkdir(deletionDirectory, { recursive: false });
  ownsDeletionDirectory = true;
  await writeFile(join(deletionDirectory, 'deletion-proof.txt'), 'Fabricated local deletion QA only.');
  const unauthorizedCron = await fetch(`${origin}/api/cron/delete-accounts`, { headers: { DNT: '1' } });
  assert.equal(unauthorizedCron.status, 401); await unauthorizedCron.arrayBuffer(); checks++;
  const processed = await fetch(`${origin}/api/cron/delete-accounts`, { headers: { Authorization: `Bearer ${cronSecret}`, DNT: '1' } });
  assert.equal(processed.status, 200); checks++;
  assert.deepEqual(await processed.json(), { examined: 2, deleted: 1, blocked: 1, uploadsDeleted: 1, uploadCleanupPending: 0 }); checks++;
  assert.equal((await qa.db.query('SELECT id FROM admin_users WHERE id=$1', [deletionUser])).rows.length, 0); checks++;
  assert.equal((await qa.db.query('SELECT id FROM events WHERE id=$1', [deletionEvent.id])).rows.length, 0); checks++;
  assert.deepEqual((await qa.db.query('SELECT user_id,organization_id FROM events WHERE id=$1', [inheritedEvent])).rows[0], { user_id: futureUser, organization_id: inheritedOrg }); checks++;
  assert.equal((await qa.db.query<{ role: string }>('SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2', [inheritedOrg, futureUser])).rows[0].role, 'owner'); checks++;
  assert.deepEqual((await qa.db.query('SELECT user_id,organization_id FROM events WHERE id=$1', [coownedEvent])).rows[0], { user_id: cancelledUser, organization_id: coownedOrg }); checks++;
  assert.equal((await qa.db.query('SELECT id FROM organizations WHERE id=$1', [orphanOrg])).rows.length, 0); checks++;
  const rehomed = (await qa.db.query<{ user_id: string; created_by: string; is_personal: boolean }>('SELECT e.user_id,o.created_by,o.is_personal FROM events e JOIN organizations o ON o.id=e.organization_id WHERE e.id=$1', [survivingEvent])).rows[0];
  assert.deepEqual(rehomed, { user_id: futureUser, created_by: futureUser, is_personal: true }); checks++;
  assert.equal((await qa.db.query('SELECT id FROM user_sessions WHERE user_id=$1', [deletionUser])).rows.length, 0); checks++;
  assert.equal((await qa.db.query('SELECT mutation_key FROM mobile_event_mutations WHERE user_id=$1', [deletionUser])).rows.length, 0); checks++;
  assert.equal((await qa.db.query('SELECT id FROM admin_users WHERE id IN (SELECT value FROM json_each($1))', [[futureUser, cancelledUser, paidUser]])).rows.length, 3); checks++;
  await assert.rejects(access(deletionDirectory), { code: 'ENOENT' }); checks++;
  await request('me', 401, deletionToken);
  // Once billing is cancelled, a formerly blocked request can finish on a later run.
  await qa.db.query("UPDATE user_subscriptions SET status='canceled' WHERE user_id=$1", [paidUser]);
  const resumed = await fetch(`${origin}/api/cron/delete-accounts`, { headers: { Authorization: `Bearer ${cronSecret}`, DNT: '1' } });
  assert.equal(resumed.status, 200); checks++;
  assert.deepEqual(await resumed.json(), { examined: 1, deleted: 1, blocked: 0, uploadsDeleted: 1, uploadCleanupPending: 0 }); checks++;
  console.log(`PASS: ${checks} isolated native/web HTTP assertions. No provider communication or production access.`);
} finally {
  app.kill('SIGTERM'); await new Promise(resolve => app.once('exit', resolve));
  await log.close(); await qa.server.stop(); await qa.db.close();
  if (ownsDeletionDirectory) await rm(deletionDirectory, { recursive: true, force: true });
}

}
void main().catch(error => { console.error(error); process.exitCode = 1; });

/** Isolated native-app HTTP checks. Synthetic PostgreSQL; never sends email. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { startSocialQa } from './start-social-qa';
import { hashAuthCode } from '../../src/lib/auth/code-hash';

const origin = 'http://127.0.0.1:3130';
const secret = 'local-mobile-auth-code-secret-for-qa-only';
process.env.SEALSEND_QA_USE_POSTGRES = 'true';
process.env.SESSION_SECRET = secret;
const owner = '00000000-0000-4000-8000-000000000010';
const eventId = '00000000-0000-4000-8000-000000000011';
const guestId = '00000000-0000-4000-8000-000000000012';
async function main() {
const qa = await startSocialQa();
const log = await open('/tmp/sealsend-mobile-http.log', 'w');
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3130'], {
  stdio: ['ignore', log.fd, log.fd], env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55432/postgres', SESSION_SECRET: secret, ENABLE_NATIVE_MOBILE_API: 'true', COMMUNICATIONS_TEST_ONLY: 'true', PAYMENTS_TEST_ONLY: 'true', AI_PROVIDER: 'fake', NEXT_PUBLIC_SITE_URL: origin },
});
let checks = 0;
async function request(path: string, status: number, token?: string, method = 'GET', body?: unknown, web = false, mutationKey?: string) {
  const response = await fetch(`${origin}/api/${web ? '' : 'mobile/v1/'}${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', DNT: '1', ...(!web && path === 'events' && method === 'POST' ? { 'Idempotency-Key': mutationKey || randomUUID() } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(response.status, status, `${method} ${path}`);
  if (!web) assert.match(response.headers.get('cache-control') || '', /no-store/);
  checks++;
  return response;
}
async function code(email: string, value: string) {
  await qa.db.query("INSERT INTO auth_codes(email,code_hash,role,expires_at) VALUES ($1,$2,'admin',NOW()+INTERVAL '15 minutes')", [email, hashAuthCode({ code: value, recipient: email, role: 'admin' })]);
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
  await qa.db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'admin',$2,NOW()+INTERVAL '1 day')", [owner, ownerToken]);
  await request(`events/${eventId}/check-in`, 200, ownerToken);
  const arrival = await (await request(`events/${eventId}/check-in`, 200, ownerToken, 'PATCH', { inviteToken: 'a'.repeat(24), checkedIn: true })).json();
  assert.equal(arrival.id, guestId); assert.ok(arrival.checked_in_at);
  const repeatedArrival = await (await request(`events/${eventId}/check-in`, 200, ownerToken, 'PATCH', { guestId, checkedIn: true })).json();
  assert.equal(repeatedArrival.checked_in_at, arrival.checked_in_at, 'retries preserve arrival time');
  const audit = await qa.db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM event_audit_log WHERE event_id = $1 AND action = 'guest_checked_in'", [eventId]);
  assert.equal(audit.rows[0].count, '1', 'retries must not duplicate arrival side effects');
  checks += 2;
  await request(`events/${eventId}/check-in`, 200, ownerToken, 'PATCH', { guestId, checkedIn: false });
  const guestToken = randomUUID();
  await qa.db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'guest',$2,NOW()+INTERVAL '1 day')", [guestId, guestToken]);
  await request('me', 403, guestToken);
  const deletion = await (await request('account/deletion', 202, token, 'POST')).json();
  const repeatedDeletion = await (await request('account/deletion', 202, token, 'POST')).json();
  assert.equal(repeatedDeletion.request.scheduled_for, deletion.request.scheduled_for); checks++;
  await request('account/deletion', 200, token, 'GET');
  await request('account/deletion', 200, token, 'DELETE');
  await request('session', 200, token, 'DELETE');
  await request('me', 401, token);
  await qa.db.query('UPDATE user_sessions SET expires_at = NOW()-INTERVAL \'1 day\' WHERE session_token = $1', [ownerToken]);
  await request('me', 401, ownerToken);
  const orphanToken = randomUUID();
  await qa.db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'admin',$2,NOW()+INTERVAL '1 day')", [randomUUID(), orphanToken]);
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
  console.log(`PASS: ${checks} isolated native/web HTTP assertions. No provider communication or production access.`);
} finally {
  app.kill('SIGTERM'); await new Promise(resolve => app.once('exit', resolve));
  await log.close(); await qa.server.stop(); await qa.db.close();
}

}
void main().catch(error => { console.error(error); process.exitCode = 1; });

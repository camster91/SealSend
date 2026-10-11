import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invitationLink, qrToken, checkInBody, eventTime } from '../src/model';
import { Api, ApiError, apiOrigin } from '../src/api';
const token = 'a'.repeat(24);
test('guest links accept the actual public invitation and personal QR format', () => {
  assert.equal(invitationLink(' https://sealsend.app/e/friday '), 'https://sealsend.app/e/friday');
  assert.equal(qrToken(`https://sealsend.app/e/friday?t=${token}`, 'friday'), token);
  assert.equal(qrToken(`https://sealsend.app/e/friday?t=${token}`, 'saturday'), null);
  assert.equal(qrToken('https://sealsend.app/e/friday', 'friday'), null);
});
for (const link of ['http://sealsend.app/e/friday', 'https://evil.test/e/friday', 'https://sealsend.app.evil.test/e/friday', 'https://user@sealsend.app/e/friday', 'https://sealsend.app/e/friday#token', `https://sealsend.app/e/friday?t=${token}&t=${token}`, 'https://sealsend.app/e/friday?t=short', 'https://sealsend.app/events/abc/guest']) {
  test(`reject unsafe invitation: ${link.replace(token, '[fixture]')}`, () => assert.equal(invitationLink(link), null));
}
test('check-in preserves source and explicit desired state for retries', () => {
  const guest = { id: 'fixture', name: 'QA', source: 'guest' as const, headcount: 2, checked_in_at: null, rsvp_status: 'attending' };
  assert.deepEqual(checkInBody(guest), { guestId: 'fixture', checkedIn: true });
  assert.deepEqual(checkInBody({ ...guest, source: 'public_rsvp', checked_in_at: '2026-10-11' }), { rsvpResponseId: 'fixture', checkedIn: false });
});
test('event dates handle missing/invalid dates without crashing', () => {
  const event = { id: 'fixture', slug: 'test', title: 'QA', status: 'draft' as const, location_name: null, event_timezone: 'America/Toronto', event_date: null };
  assert.equal(eventTime(event), 'Date to be decided');
  assert.equal(eventTime({ ...event, event_date: 'invalid' }), 'Date unavailable');
  assert.match(eventTime({ ...event, event_date: '2026-10-11T19:00:00Z' }), /2026/);
});
test('production endpoint cannot send credentials to an alternate origin', () => {
  assert.equal(apiOrigin('https://sealsend.app', false), 'https://sealsend.app');
  for (const url of ['https://evil.test', 'http://sealsend.app', 'https://user@sealsend.app', 'https://sealsend.app/?token=abc', 'https://sealsend.app/api']) assert.throws(() => apiOrigin(url, false));
  assert.equal(apiOrigin('http://10.0.2.2:3130', true), 'http://10.0.2.2:3130');
  assert.throws(() => apiOrigin('http://evil.test', true));
});
test('native requests omit cookies, refuse redirects and use a revocable bearer', async () => {
  let calls = 0;
  const api = new Api('https://sealsend.app', (async (url, options) => {
    calls++; assert.equal(url, 'https://sealsend.app/api/mobile/v1/events');
    assert.equal(options?.credentials, 'omit'); assert.equal(options?.redirect, 'error');
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer fixture-only');
    return new Response(JSON.stringify([]));
  }) as typeof fetch);
  api.session = { sessionToken: 'fixture-only', expiresAt: '2027-01-01', user: { id: 'test', email: null, role: 'admin' } };
  assert.deepEqual(await api.request('events'), []);
  await assert.rejects(() => api.request('../events'), /Invalid API path/);
  assert.equal(calls, 1);
});
test('failures remain failures and mutations are never automatically retried', async () => {
  let calls = 0;
  const api = new Api('https://sealsend.app', (async () => { calls++; throw new Error('connection lost'); }) as typeof fetch);
  await assert.rejects(() => api.request('events', 'POST', {}), (error: unknown) => error instanceof ApiError && error.status === 0);
  assert.equal(calls, 1);
  const revoked = new Api('https://sealsend.app', (async () => new Response(JSON.stringify({ error: 'Please sign in again.' }), { status: 401 })) as typeof fetch);
  await assert.rejects(() => revoked.request('me'), (error: unknown) => error instanceof ApiError && error.status === 401);
});

test('native incoming links are bounded, allowlisted and cannot smuggle arbitrary queries', async () => {
  const { nativeDestination } = await import('../src/native-links');
  assert.equal(nativeDestination('sealsend://events'), '/events');
  assert.equal(nativeDestination('sealsend://login?redirect=https://evil.test'), '/welcome');
  assert.equal(nativeDestination('sealsend://account?x=' + '%ff'.repeat(1000)), '/welcome');
  assert.equal(nativeDestination('/events?code=private'), '/welcome');
  assert.equal(nativeDestination('https://evil.test/e/friday'), '/welcome');
  assert.equal(nativeDestination(`https://sealsend.app/e/friday?t=${token}`), `/welcome?invite=${encodeURIComponent(`https://sealsend.app/e/friday?t=${token}`)}`);
});

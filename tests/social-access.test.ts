import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSocialAccess, type AccessDeps } from '../src/lib/social/access';
import { pollSchema, DEFAULT_SOCIAL_SETTINGS, guestActionSchema } from '../src/lib/social/contracts';
const token = 'a'.repeat(24);
const event = { id: 'event-a', user_id: 'host', slug: 'test', event_date: null };
const deps: AccessDeps = {
  event: async () => event,
  guest: async (id, t) => id === 'event-a' && t === token ? { id: 'guest-a', name: 'Guest' } : null,
  session: async () => null,
};
test('public links and forged guest display data cannot access social features', async () => {
  assert.equal(await resolveSocialAccess(new Request('https://example.com', { headers: { cookie: 'sealsend_user={"role":"guest"}' } }), 'test', deps), null);
});
test('personal invitation tokens are bound to their event', async () => {
  const request = new Request('https://example.com', { headers: { 'x-guest-token': token } });
  assert.equal((await resolveSocialAccess(request, 'test', deps))?.guest.id, 'guest-a');
  assert.equal(await resolveSocialAccess(request, 'other', { ...deps, event: async () => ({ ...event, id: 'event-b' }) }), null);
});
test('database-backed guest sessions cannot cross events and hosts cannot impersonate a guest', async () => {
  for (const role of ['guest', 'admin'] as const) {
    const d = { ...deps, session: async () => ({ id: 'g', role, eventId: 'other', name: 'Guest', email: null, phone: null }) };
    assert.equal(await resolveSocialAccess(new Request('https://example.com'), 'test', d), null);
  }
});
test('features default off, photos default to approval, polls reject duplicates and guest IDs', () => {
  assert.equal(DEFAULT_SOCIAL_SETTINGS.photos_enabled, false);
  assert.equal(DEFAULT_SOCIAL_SETTINGS.photo_approval, true);
  assert.equal(pollSchema.safeParse({ question: 'Choice?', options: ['One', 'one'] }).success, false);
  assert.equal(guestActionSchema.safeParse({ action: 'visibility', show_name: true, guest_id: 'forged' }).success, false);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DraftStore, draftForHost, readHostRecovery } from '../src/draft-store';
const key = '00000000-0000-4000-8000-000000000030';
const body = { title: 'QA gathering', description: '🎉'.repeat(1800), location_name: 'QA Hall', event_date: '2026-11-01T19:00:00Z', event_timezone: 'America/Toronto', status: 'draft' as const };
function storage() { const rows = new Map<string, string>(); return { rows, get: async (key: string) => rows.get(key) ?? null, set: async (key: string, value: string) => { assert.ok(Buffer.byteLength(value) < 2000); rows.set(key,value); }, remove: async (key: string) => { rows.delete(key); } }; }
test('draft key and full Unicode payload survive app/store re-instantiation', async () => {
  const io = storage(); const first = new DraftStore(io, () => key);
  await first.prepare('host', body);
  const restarted = new DraftStore(io, () => { throw new Error('must reuse original key'); });
  assert.deepEqual(await restarted.prepare('host', body), { key, hostId: 'host', body });
  await assert.rejects(() => restarted.prepare('host', { ...body, title: 'Different' }), /unconfirmed draft/);
  await assert.rejects(() => restarted.prepare('another-host', body), /unconfirmed draft/);
  await restarted.clear(); assert.equal(await restarted.read(), null); assert.equal(io.rows.size, 0);
});
test('storage failure cannot create a committed record or allow a request to start', async () => {
  const io = storage(); let writes = 0;
  const failing = new DraftStore({ ...io, set: async (k,v) => { if (++writes === 2) throw new Error('disk failure'); await io.set(k,v); } }, () => key);
  await assert.rejects(() => failing.prepare('host',body), /disk failure/);
  assert.equal(await new DraftStore(io, () => key).read(), null);
  await new DraftStore(io, () => key).clear(); assert.equal(io.rows.size, 0);
});

test('sign-out still clears credentials and the view when draft cleanup fails', async () => {
  const { clearLocalIdentity } = await import('../src/sign-out');
  let credentialsCleared = false; let viewCleared = false;
  const result = await clearLocalIdentity(async () => { throw new Error('draft storage failed'); }, async () => { credentialsCleared = true; }, () => { viewCleared = true; });
  assert.equal(credentialsCleared, true); assert.equal(viewCleared, true);
  assert.deepEqual(result, { draftCleared: false, credentialsCleared: true });
});
test('sign-out reports credential storage failures but always clears private UI', async () => {
  const { clearLocalIdentity } = await import('../src/sign-out');
  let viewCleared = false;
  const result = await clearLocalIdentity(async () => {}, async () => { throw new Error('locked keychain'); }, () => { viewCleared = true; });
  assert.equal(viewCleared, true); assert.equal(result.credentialsCleared, false);
});

test('pending recovery details are invisible when signed out or using another account', () => {
  const pending = { key, hostId: 'first-host', body };
  assert.equal(draftForHost(pending, null), null);
  assert.equal(draftForHost(pending, 'second-host'), null);
  assert.equal(draftForHost(pending, 'first-host'), pending);
  assert.equal(draftForHost(null, 'first-host'), null);
});

test('one failed draft deletion does not prevent other fragments being removed', async () => {
  const io = storage(); await new DraftStore(io, () => key).prepare('host', body);
  let attempts = 0;
  const store = new DraftStore({ ...io, remove: async k => { attempts++; if (k.endsWith('-1')) throw new Error('locked item'); await io.remove(k); } }, () => key);
  await assert.rejects(() => store.clear(), /could not be fully cleared/);
  assert.equal(attempts, 33); assert.equal(io.rows.size, 1);
});
test('corrupt recovery storage does not throw through authentication', async () => {
  const recovery = await readHostRecovery(async () => { throw new SyntaxError('corrupt metadata'); }, 'host');
  assert.deepEqual(recovery, { draft: null, unavailable: true });
  assert.deepEqual(await readHostRecovery(async () => ({ key, hostId: 'other-host', body }), 'host'), { draft: null, unavailable: true });
});
test('a synchronous draft-cleanup failure still attempts credential removal', async () => {
  const { clearLocalIdentity } = await import('../src/sign-out');
  let credentials = false; let view = false;
  const result = await clearLocalIdentity(() => { throw new Error('synchronous failure'); }, async () => { credentials = true; }, () => { view = true; });
  assert.equal(credentials, true); assert.equal(view, true); assert.equal(result.draftCleared, false);
});

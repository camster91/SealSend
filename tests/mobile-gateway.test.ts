import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mobileOperation, mobileBearer } from '../src/lib/mobile/routes';
import { getMobileContext, withMobileContext } from '../src/lib/auth/mobile-context';
const uuid = '00000000-0000-4000-8000-000000000011';
test('mobile gateway only routes the explicitly supported host operations', () => {
  assert.deepEqual(mobileOperation('PATCH', ['events', uuid, 'check-in']), { operation: 'checkIn', eventId: uuid });
  assert.deepEqual(mobileOperation('POST', ['auth', 'verify']), { operation: 'verifyCode' });
  for (const [method, path] of [['POST', ['billing']], ['GET', ['events', 'invalid']], ['DELETE', ['events', uuid]], ['POST', ['events', uuid, 'send']], ['GET', ['events', uuid, 'check-in', 'extra']], ['GET', ['account', 'export']]] as const) assert.equal(mobileOperation(method, [...path]), null);
});
test('bearer credentials must have the exact supported format', () => {
  assert.equal(mobileBearer(`Bearer ${uuid}`), uuid);
  for (const value of [null, uuid, 'Bearer fixture', `Bearer ${uuid} extra`, `Bearer ${uuid}\n`, `Basic ${uuid}`]) assert.equal(mobileBearer(value), null);
});
test('request identity is isolated across concurrent async work and cannot leak to web auth', async () => {
  const user = { id: uuid, email: 'qa@example.test', phone: null, role: 'admin' as const };
  assert.equal(getMobileContext(), undefined);
  const results = await Promise.all([
    withMobileContext({ user, sessionToken: 'fixture' }, async () => { await new Promise(resolve => setTimeout(resolve, 5)); return getMobileContext()?.user?.id; }),
    withMobileContext({ user: null, sessionToken: null }, async () => { await Promise.resolve(); return getMobileContext()?.user; }),
  ]);
  assert.deepEqual(results, [uuid, null]);
  assert.equal(getMobileContext(), undefined);
});

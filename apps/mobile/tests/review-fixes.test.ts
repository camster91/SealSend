import test from 'node:test';
import assert from 'node:assert/strict';
import { Api, ApiError } from '../src/api';

test('Api surfaces publish blockers on 400 and skips Authorization on auth/* routes', async () => {
  const seenHeaders: Array<Record<string, string>> = [];
  const api = new Api('https://sealsend.app', async (_url, init) => {
    seenHeaders.push((init?.headers ?? {}) as Record<string, string>);
    return new Response(
      JSON.stringify({ error: 'Event is not ready to publish', blockers: ['Add an event date.', 'Add a location.'] }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  });
  api.session = { sessionToken: 'stale-token', expiresAt: '2030-01-01T00:00:00.000Z', user: { id: 'u1', email: 'a@b.test', role: 'admin' } };

  await assert.rejects(
    () => api.request('auth/password', 'POST', { email: 'a@b.test', password: 'bad' }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.match(err.message, /Add an event date\./);
      assert.deepEqual(err.blockers, ['Add an event date.', 'Add a location.']);
      return true;
    },
  );
  assert.equal(seenHeaders[0].Authorization, undefined);
});

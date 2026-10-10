import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMarketingChannel, marketingMeasurement, marketingSignupHref } from '../src/lib/analytics/marketing-attribution';
import { recordMarketingViewSafely } from '../src/lib/analytics/marketing-views';
import { verifyCodeSchema } from '../src/lib/validations';

const normal = () => ({ url: 'https://sealsend.app/', method: 'GET', hasSession: false, headers: new Headers({ accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/130', 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate' }) });
test('only broad source buckets survive attribution', () => {
  assert.equal(classifyMarketingChannel(new URL('https://sealsend.app/?utm_medium=email&utm_source=person@example.test'), null), 'email');
  assert.equal(classifyMarketingChannel(new URL('https://sealsend.app/'), 'https://www.google.ca/search?q=private'), 'organic_search');
  assert.equal(classifyMarketingChannel(new URL('https://sealsend.app/'), 'https://google.com.evil.test/'), 'referral');
  assert.equal(classifyMarketingChannel(new URL('https://sealsend.app/?source=person@example.test'), null), 'unknown');
  assert.equal(marketingSignupHref('email'), '/signup?source=email');
  assert.equal(marketingSignupHref('direct'), '/signup');
});
test('private paths, sessions, bots, opt-outs and non-document requests are excluded', () => {
  assert.deepEqual(marketingMeasurement(normal()), { path: '/', channel: 'direct' });
  for (const path of ['/e/private-event', '/invite/private', '/signup', '/api/events', '/support', '/privacy']) {
    assert.equal(marketingMeasurement({ ...normal(), url: `https://sealsend.app${path}` }), null);
  }
  assert.equal(marketingMeasurement({ ...normal(), hasSession: true }), null);
  assert.equal(marketingMeasurement({ ...normal(), method: 'POST' }), null);
  for (const [name, value] of [['DNT','1'], ['Sec-GPC','1'], ['RSC','1'], ['Next-Router-Prefetch','1'], ['Purpose','prefetch'], ['Sec-Purpose','prefetch'], ['Accept','text/x-component'], ['Sec-Fetch-Dest','empty'], ['Sec-Fetch-Mode','cors'], ['User-Agent','Googlebot'], ['User-Agent','HeadlessChrome']]) {
    const request = normal(); request.headers.set(name, value);
    assert.equal(marketingMeasurement(request), null, name);
  }
  assert.equal(marketingMeasurement({ ...normal(), url: 'https://sealsend.app/?_rsc=x' }), null);
});
test('daily counter is parameterized, canonicalized and fails open', async () => {
  const calls: Array<{sql:string; params:unknown[] | undefined}> = [];
  const execute = async (sql:string, params?:unknown[]) => { calls.push({sql,params}); return []; };
  assert.equal(await recordMarketingViewSafely('/', 'private@example.test', execute), true);
  assert.deepEqual(calls[0].params, ['/', 'unknown']);
  assert.match(calls[0].sql, /ON CONFLICT[\s\S]*DO UPDATE/);
  assert.match(calls[0].sql, /DELETE FROM marketing_pageviews/);
  assert.equal(calls[0].sql.includes('private@example.test'), false);
  assert.equal(await recordMarketingViewSafely('/e/private', 'email', execute), false);
  assert.equal(calls.length, 1);
  assert.equal(await recordMarketingViewSafely('/', 'direct', async () => { throw new Error('unavailable'); }), false);
});
test('invalid optional analytics data cannot block valid authentication', () => {
  const result = verifyCodeSchema.safeParse({method:'email',email:'fixture@example.test',code:'123456',channel:'private-campaign'});
  assert.equal(result.success, true);
  if(result.success) assert.equal(result.data.channel, undefined);
});

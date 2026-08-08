import assert from 'node:assert/strict';
import test from 'node:test';
import { getClientIp } from '../src/lib/rate-limit';

test('proxy headers are ignored unless explicitly trusted', () => {
  delete process.env.TRUST_PROXY_HEADERS;
  const request = new Request('https://sealsend.app/login', {
    headers: {
      'x-real-ip': '203.0.113.10',
      'x-forwarded-for': '198.51.100.20',
    },
  });

  assert.equal(getClientIp(request), 'unknown');
});

test('explicitly trusted proxy headers return a validated address', () => {
  process.env.TRUST_PROXY_HEADERS = 'true';
  const request = new Request('https://sealsend.app/login', {
    headers: { 'x-real-ip': '203.0.113.10' },
  });

  assert.equal(getClientIp(request), '203.0.113.10');
  delete process.env.TRUST_PROXY_HEADERS;
});

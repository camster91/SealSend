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

test('CF-Connecting-IP is only used when Cloudflare is explicitly trusted, and beats forged forwarding headers', () => {
  const request = new Request('https://sealsend.app/login', {
    headers: { 'cf-connecting-ip': '203.0.113.50', 'x-forwarded-for': '198.51.100.99' },
  });

  delete process.env.TRUST_CF_CONNECTING_IP;
  delete process.env.TRUST_PROXY_HEADERS;
  assert.equal(getClientIp(request), 'unknown');

  process.env.TRUST_CF_CONNECTING_IP = 'true';
  process.env.TRUST_PROXY_HEADERS = 'true';
  assert.equal(getClientIp(request), '203.0.113.50');
  assert.equal(getClientIp(new Request('https://sealsend.app/login', { headers: { 'cf-connecting-ip': 'not-an-ip' } })), 'unknown');

  delete process.env.TRUST_CF_CONNECTING_IP;
  delete process.env.TRUST_PROXY_HEADERS;
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { generateMagicToken, hashMagicToken, previewMagicToken } from '../src/lib/magic-token';

test('generates URL-safe tokens with at least 256 bits of entropy', () => {
  const first = generateMagicToken();
  const second = generateMagicToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test('hashes tokens deterministically without retaining the raw token', () => {
  const token = 'test_token-123';
  const hash = hashMagicToken(token);

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, hashMagicToken(token));
  assert.notEqual(hash, token);
});

test('previews only the final four token characters', () => {
  assert.equal(previewMagicToken('abcdefgh'), 'efgh');
});

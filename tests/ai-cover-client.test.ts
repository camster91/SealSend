import assert from 'node:assert/strict';
import test from 'node:test';
import { coverFailureMessage, COVER_STYLES } from '../src/lib/event-builder/ai-cover';

test('maps each response to its copy', () => {
  assert.equal(coverFailureMessage(429, 'AI_COVER_LIMIT'), "You've used today's 3 AI covers. Upload your own, or try again tomorrow.");
  assert.equal(coverFailureMessage(422, 'AI_REFUSED'), "That description can't be used for a cover. Try different words.");
  assert.equal(coverFailureMessage(413, undefined), 'Your upload space is full.');
  for (const [s, c] of [[502, 'AI_FAILED'], [503, 'AI_UNAVAILABLE'], [400, undefined], [500, undefined], [undefined, undefined]] as const) {
    assert.equal(coverFailureMessage(s, c), "We couldn't make a cover right now. Try again, or upload your own.");
  }
});

test('413 is read by status, not code', () => {
  assert.equal(coverFailureMessage(413, 'AI_FAILED'), 'Your upload space is full.');
});

test('styles default to elegant and use the host labels', () => {
  assert.equal(COVER_STYLES[0].value, 'elegant');
  assert.deepEqual(COVER_STYLES.map((s) => s.label), ['Elegant', 'Playful', 'Watercolor', 'Photo-style', 'Minimal']);
});

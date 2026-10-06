import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const dir = 'src/components/events/builder/';
const BANNED = ['gray-', 'indigo', '#6366f1', 'brand-600'];

test('BuilderShell has motion, live region and step copy', async () => {
  const src = await read(`${dir}BuilderShell.tsx`);
  for (const needle of ['useReducedMotion', 'aria-live', 'AnimatePresence', 'Step ${']) {
    assert.ok(src.includes(needle), `missing ${needle}`);
  }
  assert.ok(src.includes('Next: '), 'Next label');
  assert.ok(src.includes('lg:'), 'desktop breakpoint');
});

test('builder shell files use no banned tokens or phrases', async () => {
  for (const file of ['BuilderShell', 'InvitePreview', 'SaveIndicator', 'StepNav']) {
    const src = await read(`${dir}${file}.tsx`).catch(() => '');
    for (const word of [...BANNED, 'publish blocker', 'operations brief', 'explicit decisions', 'communication plan']) {
      assert.ok(!src.includes(word), `${file} contains ${word}`);
    }
  }
});

test('InvitePreview renders the public components', async () => {
  const src = await read(`${dir}InvitePreview.tsx`);
  assert.match(src, /import[^;]*EventHero[^;]*public-event/);
  assert.match(src, /import[^;]*EventDetails[^;]*public-event/);
  assert.ok(src.includes('builderDataToPreviewEvent'));
});

test('SaveIndicator has the status copy', async () => {
  const src = await read(`${dir}SaveIndicator.tsx`);
  for (const needle of ['Saving…', 'Saved', 'Not saved, retrying…', 'Try again', 'aria-live']) {
    assert.ok(src.includes(needle), `missing ${needle}`);
  }
});

test('LookScreen has the copy, upload route and template wiring', async () => {
  const src = await read(`${dir}screens/LookScreen.tsx`);
  for (const needle of [
    'Make it yours',
    'font-display',
    'Artwork crop and focus',
    'keeps the uploaded original',
    'max 10 MB for images, 50 MB for video',
    'uploadFailureMessage',
    'applyStyle(',
    '/api/upload',
    'EVENT_TEMPLATES',
    'ensureDraft',
    'aria-live="polite"',
  ]) {
    assert.ok(src.includes(needle), `missing ${needle}`);
  }
  const look = await read('src/lib/event-builder/look.ts');
  assert.ok(look.includes("That file didn't upload. Try a smaller file (max 10 MB for images, 50 MB for video)."));
  assert.ok(look.includes('Your upload space is full.'));
});

test('Look screen files use no banned tokens or phrases', async () => {
  for (const file of ['LookScreen', 'LookMoreOptions']) {
    const src = await read(`${dir}screens/${file}.tsx`).catch(() => '');
    assert.ok(src.length > 0, `${file} missing`);
    for (const word of [...BANNED, 'publish blocker', 'operations brief', 'explicit decisions', 'communication plan']) {
      assert.ok(!src.includes(word), `${file} contains ${word}`);
    }
  }
});

test('GuestsScreen has the copy, bulk route and skip button', async () => {
  const src = await read(`${dir}screens/GuestsScreen.tsx`);
  for (const needle of [
    "Who's coming?",
    'font-display',
    'Add guests later',
    'parseGuestCsv',
    '/guests/bulk',
    'ensureDraft',
    'goTo("review")',
    'Paste a list (one guest per line, or name, email)',
    'aria-live="polite"',
    'Manage guests later on the event page',
  ]) {
    assert.ok(src.includes(needle), `missing ${needle}`);
  }
});

test('Guests screen files use no banned tokens or phrases', async () => {
  const src = await read(`${dir}screens/GuestsScreen.tsx`).catch(() => '');
  assert.ok(src.length > 0, 'GuestsScreen missing');
  for (const word of [...BANNED, 'publish blocker', 'operations brief', 'explicit decisions', 'communication plan']) {
    assert.ok(!src.includes(word), `GuestsScreen contains ${word}`);
  }
});

test('ReviewScreen has the copy, readiness check, publish route and draft button', async () => {
  const src = await read(`${dir}screens/ReviewScreen.tsx`);
  for (const needle of [
    'Ready to send?',
    'font-display',
    'Questions to ask guests',
    'getPublicationReadiness',
    'Publish',
    'Save as draft',
    '/publish',
    '/rsvp-fields',
    'defaultInvitationCopy',
    'goTo("basics")',
    'markPublished',
    'PublishedCelebration',
  ]) {
    assert.ok(src.includes(needle), `missing ${needle}`);
  }
});

test('PublishedCelebration has the copy, copy-link, add-guests and reduced motion', async () => {
  const src = await read(`${dir}PublishedCelebration.tsx`);
  for (const needle of ['Your invite is live', 'Copy link', 'Add guests', 'useReducedMotion', 'animate-seal-press', 'aria-live="polite"', 'Link copied']) {
    assert.ok(src.includes(needle), `missing ${needle}`);
  }
});

test('Review files use no banned tokens or phrases', async () => {
  for (const file of ['screens/ReviewScreen', 'PublishedCelebration']) {
    const src = await read(`${dir}${file}.tsx`).catch(() => '');
    assert.ok(src.length > 0, `${file} missing`);
    for (const word of [...BANNED, 'publish blocker', 'operations brief', 'explicit decisions', 'communication plan']) {
      assert.ok(!src.includes(word), `${file} contains ${word}`);
    }
  }
});

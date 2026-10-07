import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const PANEL = 'src/components/events/builder/screens/AiCoverPanel.tsx';
const BANNED = ['gray-', 'indigo', '#6366f1', 'brand-600'];

test('panel and helper carry the exact copy', async () => {
  const src = (await read(PANEL)) + (await read('src/lib/event-builder/ai-cover.ts'));
  for (const needle of [
    "You've used today's 3 AI covers. Upload your own, or try again tomorrow.",
    "We couldn't make a cover right now. Try again, or upload your own.",
    "That description can't be used for a cover. Try different words.",
    'Your upload space is full.',
    'Making your cover… about 30 seconds',
    'Generate with AI',
    'Use this',
    'Try again (',
    'Anything else? (e.g. autumn leaves, navy and gold)',
    ' left today',
    'Elegant', 'Playful', 'Watercolor', 'Photo-style', 'Minimal',
  ]) assert.ok(src.includes(needle), `missing: ${needle}`);
});

test('panel is accessible and on-token', async () => {
  const src = await read(PANEL);
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /<label[^>]*htmlFor=/);
  assert.match(src, /maxLength=\{300\}/);
  assert.match(src, /role="radiogroup"/);
  assert.match(src, /motion-reduce/);
  for (const b of BANNED) assert.ok(!src.includes(b), `banned: ${b}`);
});

test('only Use this updates the draft, and the host is never changed by a failure', async () => {
  const src = await read(PANEL);
  const calls = src.match(/ctx\.update\(|\bupdate\(/g) ?? [];
  assert.equal(calls.length, 1);
  assert.match(src, /ctx\.update\(\{ design_url: [^}]*design_type: "image" \}\)/);
  assert.match(src, /ctx\.ensureDraft\(\)/);
});

test('the panel is only rendered behind aiCoverEnabled, threaded from every page', async () => {
  const look = await read('src/components/events/builder/screens/LookScreen.tsx');
  assert.match(look, /ctx\.aiCoverEnabled && <AiCoverPanel/);
  const shell = await read('src/components/events/builder/BuilderShell.tsx');
  assert.match(shell, /aiCoverEnabled/);
  for (const f of [
    'src/components/events/builder/EventBuilder.tsx',
    'src/components/events/builder/chat/ChatBuilder.tsx',
    'src/components/events/builder/StartScreen.tsx',
    'src/app/(dashboard)/events/new/page.tsx',
    'src/app/(dashboard)/events/[eventId]/build/page.tsx',
    'src/app/(dashboard)/events/[eventId]/edit/page.tsx',
    'src/app/(dashboard)/events/[eventId]/chat/page.tsx',
  ]) assert.match(await read(f), /aiCoverEnabled/, f);
  for (const f of [
    'src/app/(dashboard)/events/new/page.tsx',
    'src/app/(dashboard)/events/[eventId]/build/page.tsx',
    'src/app/(dashboard)/events/[eventId]/edit/page.tsx',
    'src/app/(dashboard)/events/[eventId]/chat/page.tsx',
  ]) assert.match(await read(f), /isAiCoverConfigured\(\)/, f);
});

test('privacy page names cover images', async () => {
  const src = await read('src/app/(marketing)/privacy/page.tsx');
  assert.ok(src.includes('AI drafting, chat or cover images (event title, description, chosen style and your note)'));
});

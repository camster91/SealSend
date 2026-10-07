import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const dir = 'src/components/events/builder/chat/';
const FILES = ['ChatBuilder', 'ChatMessages', 'ChatChips', 'ChatComposer'];
const BANNED = ['gray-', 'indigo', '#6366f1', 'brand-600'];

async function readAll() {
  const parts = await Promise.all([
    ...FILES.map((f) => read(`${dir}${f}.tsx`)),
    read('src/lib/event-builder/chat-client.ts'),
  ]);
  return parts.join('\n');
}

test('chat UI carries the exact host-facing copy', async () => {
  const src = await readAll();
  for (const needle of [
    "You've used today's AI help. Keep going in manual mode — everything you've filled in is saved.",
    'The assistant is having trouble right now.',
    'Hi! What are you planning?',
    '"Birthday party"',
    '"Community dinner"',
    '"Wedding"',
    '"Something else"',
    'Welcome back! What would you like to change?',
    'Looks ready! Review and publish?',
    '"Review & publish"',
    'Switch to manual',
    'Retry',
    'Preview',
  ]) {
    assert.ok(src.includes(needle), `missing ${needle}`);
  }
});

test('ChatMessages announces new assistant messages politely', async () => {
  const src = await read(`${dir}ChatMessages.tsx`);
  assert.ok(src.includes('aria-live="polite"'));
});

test('ChatComposer has a real label tied to its textarea, Enter sends and a typing indicator', async () => {
  const src = await read(`${dir}ChatComposer.tsx`);
  assert.match(src, /<label[^>]*htmlFor=/);
  assert.match(src, /<textarea[^>]*id=/s);
  assert.ok(src.includes('"Enter"'), 'Enter key handling');
  assert.ok(src.includes('shiftKey'), 'Shift+Enter keeps a newline');
  assert.ok(src.includes('maxLength'), 'caps message length');
  assert.ok(src.includes('motion-reduce:'), 'typing dots respect reduced motion');
});

test('ChatChips renders 44 px buttons', async () => {
  const src = await read(`${dir}ChatChips.tsx`);
  assert.ok(src.includes('<button'));
  assert.ok(src.includes('min-h-11'));
});

test('ChatBuilder wires the draft, the merge and the API', async () => {
  const src = await read(`${dir}ChatBuilder.tsx`);
  for (const needle of [
    'applyChatUpdates',
    'ensureDraft',
    'useEventDraft',
    'InvitePreview',
    'SaveIndicator',
    'EventBuilder',
    '/api/ai/chat',
    'flush()',
    '?step=review',
    '/build`',
    'Modal',
    'sheet',
    'lg:',
    'draftPath',
  ]) {
    assert.ok(src.includes(needle), `missing ${needle}`);
  }
  assert.ok(!/console\.(log|info|debug)/.test(src), 'never logs the conversation');
});

test('chat files use no banned tokens and no console logging', async () => {
  for (const file of FILES) {
    const src = await read(`${dir}${file}.tsx`);
    for (const word of BANNED) assert.ok(!src.includes(word), `${file} contains ${word}`);
    assert.ok(!/console\./.test(src), `${file} uses console`);
  }
});

test('useEventDraft takes an optional draftPath for the URL after creation', async () => {
  const src = await read('src/components/events/builder/useEventDraft.ts');
  assert.ok(src.includes('draftPath?: (id: string) => string'));
  assert.ok(src.includes('/events/${id}/build'), 'default stays /build');
});

test('the builder can open straight on Review from ?step=review', async () => {
  const shell = await read('src/components/events/builder/BuilderShell.tsx');
  assert.ok(shell.includes('initialScreen'));
  const page = await read('src/app/(dashboard)/events/[eventId]/build/page.tsx');
  assert.ok(page.includes('searchParams'));
  assert.ok(page.includes("'review'"));
});

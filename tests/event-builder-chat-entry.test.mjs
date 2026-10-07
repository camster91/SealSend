import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('start screen shows the Chat card only behind aiChatEnabled, in the fresh view', async () => {
  const src = await read('src/components/events/builder/StartScreen.tsx');
  assert.match(src, /aiChatEnabled\s*&&/);
  assert.ok(src.includes('Chat with AI'));
  assert.ok(src.includes('Tell me about your event and I&apos;ll build it.'));
  assert.ok(src.includes('<ChatBuilder'));
  const page = await read('src/app/(dashboard)/events/new/page.tsx');
  assert.ok(page.includes('aiChatEnabled={isAiChatConfigured()}'));
});

test('builder pages pass aiChatEnabled and the shell links to chat only with an event', async () => {
  for (const p of ['build', 'edit']) {
    const src = await read(`src/app/(dashboard)/events/[eventId]/${p}/page.tsx`);
    assert.ok(src.includes('aiChatEnabled={isAiChatConfigured()}'), p);
  }
  const shell = await read('src/components/events/builder/BuilderShell.tsx');
  assert.match(shell, /aiChatEnabled\s*&&\s*draft\.eventId/);
  assert.ok(shell.includes('Switch to chat'));
  assert.ok(shell.includes('/chat`'));
});

test('chat page checks edit access, handles archived and unconfigured chat', async () => {
  const src = await read('src/app/(dashboard)/events/[eventId]/chat/page.tsx');
  assert.match(src, /roleCan\(access\.role, 'edit_event'\)/);
  assert.ok(src.includes('isAiChatConfigured()'));
  assert.ok(src.includes('/build`'));
  assert.ok(src.includes("'archived'"));
  assert.ok(src.includes('resumed'));
});

test('privacy page names AI drafting or chat', async () => {
  const src = await read('src/app/(marketing)/privacy/page.tsx');
  assert.ok(src.includes('AI drafting or chat'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import sitemap from '../src/app/sitemap';
import { proxy } from '../src/proxy';
import { movedPage, needsSignIn } from '../src/lib/marketing-routes';
import { USE_CASE_SLUGS } from '../src/lib/use-case-content';

const read = (path: string) => readFile(path, 'utf8');

test('merged pages send visitors to the page that replaced them, keeping the query', async () => {
  const moves: Record<string, string> = {
    '/rsvp-tracking': '/how-it-works',
    '/qr-event-check-in': '/how-it-works',
    '/use-cases/community-events': '/use-cases/clubs-associations',
    '/use-cases/nonprofit-events': '/use-cases/clubs-associations',
    '/use-cases/professional-gatherings': '/use-cases/clubs-associations',
    '/use-cases/event-planners': '/use-cases',
    '/use-cases/baby-showers': '/use-cases/birthday-parties',
    '/use-cases/corporate-events': '/use-cases/clubs-associations',
  };
  for (const [from, to] of Object.entries(moves)) {
    assert.equal(movedPage(from), to, from);
    const response = await proxy(new NextRequest(`https://sealsend.app${from}?source=social`));
    assert.equal(response.status, 308, from);
    const location = new URL(response.headers.get('location')!);
    assert.equal(location.pathname + location.search, `${to}?source=social`);
    assert.equal(movedPage(to), null, `${to} must not redirect again`);
  }
  assert.equal(movedPage('/constructor'), null);
});

test('wrong addresses reach the 404 page instead of asking for a sign-in', async () => {
  for (const path of ['/pricng', '/about', '/blog/hello', '/constructor', '/%E0%A4%A']) {
    assert.equal(needsSignIn(path), false, path);
    assert.equal((await proxy(new NextRequest(`https://sealsend.app${path}`))).headers.get('location'), null, path);
  }
});

test('private pages still ask for a sign-in, however the address is written', async () => {
  for (const path of ['/dashboard', '/settings/team', '/events/new', '/events/abc/check-in', '/guest', '/team/workspace/x',
    '/ai-assistant', '/dashboard.rsc', '/%64ashboard', '/Dashboard', '/events.rsc']) {
    assert.equal(needsSignIn(path), true, path);
    const response = await proxy(new NextRequest(`https://sealsend.app${path}`));
    assert.match(response.headers.get('location') ?? '', /\/login\?redirect=/, path);
  }
  for (const path of ['/', '/templates', '/e/party', '/events/abc/guest', '/events/abc/public', '/guest/update/token', '/client/x', '/api/health']) {
    assert.equal(needsSignIn(path), false, path);
  }
});

test('every page folder is deliberately public or private', async () => {
  const top = new Set<string>();
  for (const entry of await readdir('src/app', { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('(')) { top.add(entry.name); continue; }
    for (const child of await readdir(`src/app/${entry.name}`, { withFileTypes: true })) if (child.isDirectory()) top.add(child.name);
  }
  const open = ['api', 'callback', 'client', 'e', 'forgot-password', 'how-it-works', 'install', 'invite', 'login', 'pricing',
    'privacy', 'signup', 'support', 'templates', 'terms', 'unsubscribe', 'uploads', 'use-cases'];
  for (const name of top) assert.ok(open.includes(name) !== needsSignIn(`/${name}`), `${name}: add it to the private list or this open list`);
});

test('the menus and sitemap offer three kinds of event and no merged pages', async () => {
  assert.deepEqual([...USE_CASE_SLUGS].sort(), ['birthday-parties', 'clubs-associations', 'weddings']);
  const paths = sitemap().map((entry) => new URL(entry.url).pathname);
  for (const path of paths) assert.equal(movedPage(path), null, path);
  for (const slug of USE_CASE_SLUGS) assert.ok(paths.includes(`/use-cases/${slug}`), slug);
  for (const file of ['src/components/layout/Navbar.tsx', 'src/components/layout/Footer.tsx', 'src/lib/constants.ts']) {
    for (const [, href] of (await read(file)).matchAll(/href: ?"(\/[^"]*)"/g)) assert.equal(movedPage(href), null, `${file} ${href}`);
  }
});

test('home is short and says what happens with a second event', async () => {
  const home = await read('src/app/(marketing)/page.tsx');
  const sections = home.slice(home.indexOf('return (')).match(/<[A-Z]\w+/g)!.filter((tag) => tag !== '<JsonLd');
  assert.ok(sections.length <= 6, sections.join(' '));
  assert.match(await read('src/components/pricing/PricingFAQ.tsx'), /archive/i);
  assert.match(home, /archive/i);
});

test('marketing does not promise texts or emails while they are switched off', async () => {
  const files = [
    ...(await readdir('src/components/marketing')).map((name) => `src/components/marketing/${name}`),
    'src/app/(marketing)/page.tsx', 'src/app/(marketing)/how-it-works/page.tsx', 'src/app/(marketing)/use-cases/page.tsx',
    'src/lib/use-case-content.ts',
  ];
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(source, /email invitations|by email|email updates|update by email|with a text from|emails and texts/i, file);
    assert.doesNotMatch(source, /guest-updates\.webp/, file);
  }
});

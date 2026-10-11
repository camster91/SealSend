import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from '../next.config';
import robots from '../src/app/robots';
import sitemap from '../src/app/sitemap';
import { PRIVATE_SEARCH_HEADER, PRIVATE_SEARCH_ROUTES } from '../src/lib/search-indexing';

test('application responses declare noindex even for redirects, downloads and APIs', async () => {
  const rules = await config.headers!();
  for (const source of PRIVATE_SEARCH_ROUTES) {
    assert.ok(rules.some(rule => rule.source === source && rule.headers.some(header =>
      header.key === 'X-Robots-Tag' && header.value === PRIVATE_SEARCH_HEADER)), source);
  }
});

test('crawlers can read noindex and sitemap only advertises marketing content', () => {
  const rules = robots().rules;
  assert.ok(Array.isArray(rules));
  assert.equal(rules[0].disallow, undefined);
  const paths = sitemap().map(entry => new URL(entry.url).pathname);
  for (const path of paths) {
    assert.doesNotMatch(path, /^\/(e|events|guest|client|team|invite|unsubscribe|api|uploads|login|signup|dashboard|settings)(\/|$)/);
  }
  assert.ok(paths.includes('/rsvp-tracking'));
});

test('only the marketing layout opts into indexing, including future application pages', async () => {
  const root = await readFile('src/app/layout.tsx', 'utf8');
  const marketing = await readFile('src/app/(marketing)/layout.tsx', 'utf8');
  assert.match(root, /robots: PRIVATE_PAGE_ROBOTS/);
  assert.match(marketing, /robots: MARKETING_PAGE_ROBOTS/);
});

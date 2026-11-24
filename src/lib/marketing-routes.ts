/** Pages that were merged into another one. Old links and search results keep working. */
const MOVED_PAGES = new Map<string, string>([
  ['/rsvp-tracking', '/how-it-works'],
  ['/qr-event-check-in', '/how-it-works'],
  ['/use-cases/community-events', '/use-cases/clubs-associations'],
  ['/use-cases/nonprofit-events', '/use-cases/clubs-associations'],
  ['/use-cases/professional-gatherings', '/use-cases/clubs-associations'],
  ['/use-cases/corporate-events', '/use-cases/clubs-associations'],
  ['/use-cases/baby-showers', '/use-cases/birthday-parties'],
  ['/use-cases/event-planners', '/use-cases'],
]);

export function movedPage(pathname: string): string | null {
  return MOVED_PAGES.get(pathname.replace(/\/+$/, '')) ?? null;
}

// A new app section must be listed here: tests/simple-marketing.test.ts fails until every
// folder in src/app is either on this list or deliberately open.
const PRIVATE_SECTIONS = new Set(['dashboard', 'settings', 'templates', 'ai-assistant', 'events', 'guest', 'team']);

/** Wrong addresses are not private, so they reach the 404 page instead of the sign-in page. */
export function needsSignIn(pathname: string): boolean {
  let path = pathname;
  try { path = decodeURIComponent(pathname); } catch { /* A malformed address matches no section. */ }
  const section = path.split('/').filter(Boolean)[0]?.split('.')[0].toLowerCase();
  if (!section || !PRIVATE_SECTIONS.has(section)) return false;
  if (path === '/guest/update' || path.startsWith('/guest/update/')) return false;
  return !/^\/events\/[^/]+\/(guest|public)$/.test(path);
}

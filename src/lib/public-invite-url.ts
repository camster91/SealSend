/** Sharing never forwards the personal invitation's credentials or query string. */
export function publicInviteUrl(origin: string, slug: string): string {
  return new URL(`/e/${encodeURIComponent(slug)}`, origin).href;
}

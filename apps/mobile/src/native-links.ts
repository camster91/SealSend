import { invitationLink } from './model';
const routes = new Set(['/welcome', '/login', '/events', '/account']);
/** Never forward arbitrary query strings or malformed encoded paths to Router. */
export function nativeDestination(path: string): string {
  if (path.length > 512) return '/welcome';
  const invitation = invitationLink(path);
  if (invitation) return `/welcome?invite=${encodeURIComponent(invitation)}`;
  if (routes.has(path)) return path;
  try {
    const url = new URL(path);
    if (url.protocol !== 'sealsend:' || url.search || url.hash || url.username || url.password) return '/welcome';
    const target = `/${url.hostname}${url.pathname}`.replace(/\/$/, '');
    return routes.has(target) ? target : '/welcome';
  } catch { return '/welcome'; }
}

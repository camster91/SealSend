import { queryOne, getDb } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/session';
import type { AuthUser } from '@/lib/auth/types';
import { SOCIAL_SCHEMA_SQL } from './schema';

export type SocialEvent = { id: string; user_id: string; event_date: string | null; slug: string };
export type SocialGuest = { id: string; name: string };
export type SocialAccess = { event: SocialEvent; guest: SocialGuest; token: string | null };
export interface AccessDeps {
  event(slug: string): Promise<SocialEvent | null>;
  guest(eventId: string, token: string): Promise<SocialGuest | null>;
  session(): Promise<AuthUser | null>;
}
const defaults: AccessDeps = {
  event: slug => queryOne<SocialEvent>("SELECT id, user_id, event_date, slug FROM events WHERE slug = $1 AND status = 'published'", [slug]),
  guest: (id, token) => queryOne<SocialGuest>('SELECT id, name FROM guests WHERE event_id = $1 AND invite_token = $2', [id, token]),
  session: getCurrentUser,
};
export const socialCookieName = (eventId: string) => `sealsend_social_${eventId}`;

/** A guessed guest ID, display cookie or public slug never grants access. */
export async function resolveSocialAccess(request: Request, slug: string, deps: AccessDeps = defaults): Promise<SocialAccess | null> {
  const event = await deps.event(slug);
  if (!event) return null;
  const cookie = (request.headers.get('cookie') ?? '').split(';').map(c => c.trim())
    .find(c => c.startsWith(`${socialCookieName(event.id)}=`))?.split('=')[1];
  const token = request.headers.get('x-guest-token') ?? cookie ?? null;
  if (token && /^[A-Za-z0-9_-]{24,100}$/.test(token)) {
    const guest = await deps.guest(event.id, token);
    if (guest) return { event, guest, token };
  }
  const user = await deps.session();
  if (user?.role === 'guest' && user.eventId === event.id && user.name) {
    return { event, guest: { id: user.id, name: user.name }, token: null };
  }
  return null;
}

let ready: Promise<void> | undefined;
/** Additive tables and deletion cleanup trigger; old versions can still run. */
export function ensureSocialSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const client = await getDb().connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('sealsend-social-schema-v1'))");
        await client.query(SOCIAL_SCHEMA_SQL);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally { client.release(); }
    })().catch(error => { ready = undefined; throw error; });
  }
  return ready;
}

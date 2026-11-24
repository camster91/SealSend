import { batch, query } from '@/lib/db/client';
import { DEFAULT_SOCIAL_SETTINGS, type SocialSettings, type SocialState, type SocialPoll } from './contracts';
/** Routes use the default `{ query, batch }` from @/lib/db/client; tests pass `openTestDb()`. */
export type SocialDb = { query: typeof query; batch: typeof batch };
export const socialDb: SocialDb = { query, batch };

export async function getSocialSettings(eventId: string, db: SocialDb = socialDb): Promise<SocialSettings> {
  const rows = await db.query<SocialSettings>('SELECT guests_enabled, reactions_enabled, polls_enabled, photos_enabled, countdown_enabled, photo_approval FROM event_social_settings WHERE event_id = $1', [eventId]);
  return rows[0] ?? { ...DEFAULT_SOCIAL_SETTINGS };
}
export async function loadSocialState(eventId: string, guestId: string | null, eventDate: string | null, host = false, db: SocialDb = socialDb): Promise<SocialState> {
  const settings = await getSocialSettings(eventId, db);
  const mine = (await db.query<{ show_name: boolean; reaction: string | null }>('SELECT show_name, reaction FROM event_social_guests WHERE event_id = $1 AND guest_id = $2', [eventId, guestId]))[0] ?? { show_name: false, reaction: null };
  // Only guests whose latest reply is "attending".
  const guests = settings.guests_enabled ? await db.query<{ name: string }>(
    `SELECT g.name FROM guests g
     JOIN event_social_guests s ON s.guest_id = g.id AND s.event_id = g.event_id AND s.show_name = 1
     WHERE g.event_id = $1
       AND (SELECT r.status FROM rsvp_responses r WHERE r.event_id = g.event_id AND r.guest_id = g.id ORDER BY r.submitted_at DESC, r.id DESC LIMIT 1) = 'attending'
     ORDER BY g.name LIMIT 500`, [eventId]) : [];
  const reactionRows = settings.reactions_enabled ? await db.query<{ reaction: string; count: number }>('SELECT reaction, COUNT(*) AS count FROM event_social_guests WHERE event_id = $1 AND reaction IS NOT NULL GROUP BY reaction', [eventId]) : [];
  const polls = settings.polls_enabled || host ? await db.query<{ id: string; question: string; options: string[]; closed: boolean }>('SELECT id, question, options, closed FROM event_social_polls WHERE event_id = $1 ORDER BY created_at DESC LIMIT 20', [eventId]) : [];
  const votes = polls.length ? await db.query<{ poll_id: string; option_index: number; count: number }>('SELECT v.poll_id, v.option_index, COUNT(*) AS count FROM event_social_votes v JOIN event_social_polls p ON p.id = v.poll_id WHERE p.event_id = $1 GROUP BY v.poll_id, v.option_index', [eventId]) : [];
  const choices = polls.length && guestId ? await db.query<{ poll_id: string; option_index: number }>('SELECT v.poll_id, v.option_index FROM event_social_votes v JOIN event_social_polls p ON p.id = v.poll_id WHERE p.event_id = $1 AND v.guest_id = $2', [eventId, guestId]) : [];
  const mappedPolls: SocialPoll[] = polls.map(p => ({ ...p, counts: p.options.map((_, i) => votes.find(v => v.poll_id === p.id && v.option_index === i)?.count ?? 0), choice: choices.find(v => v.poll_id === p.id)?.option_index ?? null }));
  // `own` is computed, so it comes back as 0/1 (or NULL without a guest) rather than a boolean.
  const photoRows = settings.photos_enabled || host ? await db.query<{ id: string; caption: string; approved: boolean; own: number | null }>('SELECT id, caption, approved, (guest_id = $2) AS own FROM event_social_photos WHERE event_id = $1 AND (approved = 1 OR guest_id = $2 OR $3 = 1) ORDER BY created_at DESC LIMIT 200', [eventId, guestId, host]) : [];
  const photos = photoRows.map(p => ({ ...p, own: Boolean(p.own) }));
  return { settings, guests, reactions: Object.fromEntries(reactionRows.map(r => [r.reaction, r.count])), mine, polls: mappedPolls, photos, event_date: eventDate };
}

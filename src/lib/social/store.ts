import { query } from '@/lib/db/client';
import { DEFAULT_SOCIAL_SETTINGS, type SocialSettings, type SocialState, type SocialPoll } from './contracts';
export type SocialQuery = <T>(sql: string, params?: unknown[]) => Promise<T[]>;

export async function getSocialSettings(eventId: string, db: SocialQuery = query): Promise<SocialSettings> {
  const rows = await db<SocialSettings>('SELECT guests_enabled, reactions_enabled, polls_enabled, photos_enabled, countdown_enabled, photo_approval FROM event_social_settings WHERE event_id = $1', [eventId]);
  return rows[0] ?? { ...DEFAULT_SOCIAL_SETTINGS };
}
export async function loadSocialState(eventId: string, guestId: string | null, eventDate: string | null, host = false, db: SocialQuery = query): Promise<SocialState> {
  const settings = await getSocialSettings(eventId, db);
  const mine = (await db<{ show_name: boolean; reaction: string | null }>('SELECT show_name, reaction FROM event_social_guests WHERE event_id = $1 AND guest_id = $2', [eventId, guestId]))[0] ?? { show_name: false, reaction: null };
  const guests = settings.guests_enabled ? await db<{ name: string }>(
    `SELECT g.name FROM guests g
     JOIN event_social_guests s ON s.guest_id = g.id AND s.event_id = g.event_id AND s.show_name
     JOIN LATERAL (SELECT status FROM rsvp_responses r WHERE r.event_id = g.event_id AND r.guest_id = g.id ORDER BY submitted_at DESC, id DESC LIMIT 1) r ON r.status = 'attending'
     WHERE g.event_id = $1 ORDER BY g.name LIMIT 500`, [eventId]) : [];
  const reactionRows = settings.reactions_enabled ? await db<{ reaction: string; count: number }>('SELECT reaction, COUNT(*)::int AS count FROM event_social_guests WHERE event_id = $1 AND reaction IS NOT NULL GROUP BY reaction', [eventId]) : [];
  const polls = settings.polls_enabled || host ? await db<{ id: string; question: string; options: string[]; closed: boolean }>('SELECT id, question, options, closed FROM event_social_polls WHERE event_id = $1 ORDER BY created_at DESC LIMIT 20', [eventId]) : [];
  const votes = polls.length ? await db<{ poll_id: string; option_index: number; count: number }>('SELECT v.poll_id, v.option_index, COUNT(*)::int AS count FROM event_social_votes v JOIN event_social_polls p ON p.id = v.poll_id WHERE p.event_id = $1 GROUP BY v.poll_id, v.option_index', [eventId]) : [];
  const choices = polls.length && guestId ? await db<{ poll_id: string; option_index: number }>('SELECT v.poll_id, v.option_index FROM event_social_votes v JOIN event_social_polls p ON p.id = v.poll_id WHERE p.event_id = $1 AND v.guest_id = $2', [eventId, guestId]) : [];
  const mappedPolls: SocialPoll[] = polls.map(p => ({ ...p, counts: p.options.map((_, i) => votes.find(v => v.poll_id === p.id && v.option_index === i)?.count ?? 0), choice: choices.find(v => v.poll_id === p.id)?.option_index ?? null }));
  const photos = settings.photos_enabled || host ? await db<{ id: string; caption: string; approved: boolean; own: boolean }>('SELECT id, caption, approved, (guest_id = $2) AS own FROM event_social_photos WHERE event_id = $1 AND (approved OR guest_id = $2 OR $3) ORDER BY created_at DESC LIMIT 200', [eventId, guestId, host]) : [];
  return { settings, guests, reactions: Object.fromEntries(reactionRows.map(r => [r.reaction, r.count])), mine, polls: mappedPolls, photos, event_date: eventDate };
}

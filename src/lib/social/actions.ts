import { guestActionSchema, hostActionSchema } from './contracts';
import type { z } from 'zod';
import type { SocialDb } from './store';
export type GuestAction = z.infer<typeof guestActionSchema>;
export type HostAction = z.infer<typeof hostActionSchema>;
// Each action is one conditional statement, so it needs no lock: the feature, poll and guest
// checks run in the same statement as the write.
export async function applyGuestAction(eventId: string, guestId: string, action: GuestAction, db: SocialDb): Promise<boolean> {
  if (action.action === 'vote') {
    const rows = await db.query(`INSERT INTO event_social_votes(poll_id,guest_id,option_index)
      SELECT p.id,g.id,$4 FROM event_social_polls p
      JOIN event_social_settings s ON s.event_id = p.event_id AND s.polls_enabled = 1
      JOIN guests g ON g.event_id = p.event_id AND g.id = $2
      WHERE p.event_id = $1 AND p.id = $3 AND p.closed = 0 AND $4 < json_array_length(p.options)
      ON CONFLICT(poll_id,guest_id) DO UPDATE SET option_index = EXCLUDED.option_index RETURNING poll_id`,
    [eventId, guestId, action.poll_id, action.option_index]);
    return rows.length > 0;
  }
  const visibility = action.action === 'visibility';
  // Fixed column names only; values always use parameters.
  const field = visibility ? 'show_name' : 'reaction';
  const feature = visibility ? 'guests_enabled' : 'reactions_enabled';
  const value = visibility ? action.show_name : action.reaction;
  const rows = await db.query(`INSERT INTO event_social_guests(event_id,guest_id,${field})
    SELECT $1,g.id,$3 FROM guests g JOIN event_social_settings s ON s.event_id = g.event_id
    WHERE g.id = $2 AND g.event_id = $1 AND (s.${feature} = 1 OR $4 = 1)
    ON CONFLICT(event_id,guest_id) DO UPDATE SET ${field} = EXCLUDED.${field} RETURNING guest_id`,
  [eventId, guestId, value, visibility ? !value : value === null]);
  return rows.length > 0;
}
export async function applyHostAction(eventId: string, action: Exclude<HostAction, { action: 'delete_photo' }>, db: SocialDb): Promise<boolean> {
  if (action.action === 'settings') {
    const s = action.settings;
    await db.query(`INSERT INTO event_social_settings(event_id,guests_enabled,reactions_enabled,polls_enabled,photos_enabled,countdown_enabled,photo_approval)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_id) DO UPDATE SET
      guests_enabled=$2,reactions_enabled=$3,polls_enabled=$4,photos_enabled=$5,countdown_enabled=$6,photo_approval=$7`,
    [eventId,s.guests_enabled,s.reactions_enabled,s.polls_enabled,s.photos_enabled,s.countdown_enabled,s.photo_approval]);
    return true;
  }
  if (action.action === 'poll') {
    // The 20-poll limit is checked in the insert itself.
    const rows = await db.query(`INSERT INTO event_social_polls(event_id,question,options)
      SELECT $1,$2,$3 WHERE (SELECT COUNT(*) FROM event_social_polls WHERE event_id = $1) < 20 RETURNING id`,
    [eventId,action.poll.question,action.poll.options]);
    return rows.length > 0;
  }
  const rows = action.action === 'close_poll'
    ? await db.query('UPDATE event_social_polls SET closed=$3 WHERE event_id=$1 AND id=$2 RETURNING id', [eventId,action.id,action.closed])
    : await db.query('UPDATE event_social_photos SET approved=1 WHERE event_id=$1 AND id=$2 RETURNING id', [eventId,action.id]);
  return rows.length > 0;
}

import { hashMagicToken } from './magic-token';
import type { RSVPSubmissionInput } from './validations';
import type { RSVPResponse } from '@/types/database';

export type RsvpQuery = <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
export class RsvpError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
// Deliberately omit edit_token_hash from every API-facing projection.
const responseColumns = 'id, event_id, guest_id, respondent_name, respondent_email, status, headcount, response_data, plus_ones_data, submitted_at';

export async function findRsvp(db: RsvpQuery, eventId: string, guestId: string | null, editToken?: string): Promise<RSVPResponse | null> {
  if (guestId) {
    return (await db<RSVPResponse>(`SELECT ${responseColumns} FROM rsvp_responses WHERE event_id = $1 AND guest_id = $2 ORDER BY updated_at DESC, submitted_at DESC, id DESC LIMIT 1`, [eventId, guestId])).rows[0] ?? null;
  }
  if (!editToken) return null;
  const row = (await db<RSVPResponse>(`SELECT ${responseColumns} FROM rsvp_responses WHERE edit_token_hash = $1`, [hashMagicToken(editToken)])).rows[0];
  if (row && (row.event_id !== eventId || row.guest_id)) throw new RsvpError('Invalid response access.');
  return row ?? null;
}

/** Caller owns BEGIN/COMMIT/ROLLBACK; identity must already be verified. */
export async function saveRsvp(db: RsvpQuery, eventId: string, guestId: string | null, editToken: string | undefined, input: RSVPSubmissionInput, responseLimit: number | null) {
  await db('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [eventId]);
  const event = (await db<{ status: string; max_attendees: number | null; allow_plus_ones: boolean; max_guests_per_rsvp: number | null; deadline_passed: boolean }>('SELECT status, max_attendees, allow_plus_ones, max_guests_per_rsvp, (rsvp_deadline <= clock_timestamp()) AS deadline_passed FROM events WHERE id = $1 FOR UPDATE', [eventId])).rows[0];
  if (!event || event.status !== 'published') throw new RsvpError('Event not found or not published', 404);
  const previous = await findRsvp(db, eventId, guestId, editToken);
  if (!previous && event.deadline_passed) throw new RsvpError('The RSVP deadline has passed. New responses are closed.');
  const headcount = event.allow_plus_ones === false ? 1 : input.headcount;
  const maxPerRsvp = event.max_guests_per_rsvp || 10;
  if (headcount > maxPerRsvp) throw new RsvpError(`Maximum ${maxPerRsvp} guests per RSVP.`, 400);
  if (input.plus_ones.length > headcount - 1) throw new RsvpError(`You can only add ${headcount - 1} additional guests.`, 400);
  if (!previous && responseLimit) {
    const count = (await db<{ count: number }>('SELECT COUNT(*)::int AS count FROM rsvp_responses WHERE event_id = $1', [eventId])).rows[0].count;
    if (count >= responseLimit) throw new RsvpError('This event has reached its maximum number of responses. The host may need to upgrade their plan.');
  }
  if (event.max_attendees && input.status === 'attending') {
    const total = (await db<{ total: number }>("SELECT COALESCE(SUM(headcount), 0)::int AS total FROM rsvp_responses WHERE event_id = $1 AND status = 'attending' AND ($2::uuid IS NULL OR id <> $2)", [eventId, previous?.id ?? null])).rows[0].total;
    if (total + headcount > event.max_attendees) {
      const left = Math.max(0, event.max_attendees - total);
      throw new RsvpError(left ? `Only ${left} spots remaining. Please reduce your guest count.` : 'This event has reached its maximum number of attendees.');
    }
  }
  const values = [eventId, input.respondent_name, input.respondent_email || null, input.status, headcount, JSON.stringify(input.response_data), JSON.stringify(input.plus_ones)];
  let response: RSVPResponse;
  if (previous) {
    response = (await db<RSVPResponse>(`UPDATE rsvp_responses SET respondent_name = $2, respondent_email = $3, status = $4, headcount = $5, response_data = $6, plus_ones_data = $7, updated_at = NOW() WHERE event_id = $1 AND id = $8 RETURNING ${responseColumns}`, [...values, previous.id])).rows[0];
    await db('DELETE FROM plus_ones WHERE rsvp_response_id = $1', [previous.id]);
  } else {
    response = (await db<RSVPResponse>(`INSERT INTO rsvp_responses (event_id, respondent_name, respondent_email, status, headcount, response_data, plus_ones_data, guest_id, edit_token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${responseColumns}`, [...values, guestId, !guestId && editToken ? hashMagicToken(editToken) : null])).rows[0];
  }
  for (const po of input.plus_ones) {
    await db('INSERT INTO plus_ones (event_id, rsvp_response_id, name, email, status) VALUES ($1,$2,$3,$4,$5)', [eventId, response.id, po.name, po.email || null, input.status]);
  }
  if (guestId) await db('UPDATE guests SET rsvp_status = $1, updated_at = NOW() WHERE id = $2 AND event_id = $3', [input.status, guestId, eventId]);
  return { response, updated: Boolean(previous) };
}

/**
 * Delete a host-managed response while keeping the invited guest's denormalized
 * RSVP status in sync. The caller owns the transaction, just like saveRsvp.
 * Taking the same event lock prevents a concurrent public reply from being
 * selected as the "remaining" response before the delete commits.
 */
export async function deleteRsvp(db: RsvpQuery, eventId: string, responseId: string): Promise<boolean> {
  await db('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [eventId]);
  const target = (await db<{ guest_id: string | null }>(
    'SELECT guest_id FROM rsvp_responses WHERE id = $1 AND event_id = $2 FOR UPDATE',
    [responseId, eventId]
  )).rows[0];
  if (!target) return false;

  await db('DELETE FROM rsvp_responses WHERE id = $1 AND event_id = $2', [responseId, eventId]);

  if (target.guest_id) {
    const remaining = (await db<{ status: string }>(
      `SELECT status FROM rsvp_responses
       WHERE event_id = $1 AND guest_id = $2
       ORDER BY updated_at DESC NULLS LAST, submitted_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [eventId, target.guest_id]
    )).rows[0];
    await db(
      'UPDATE guests SET rsvp_status = $1, updated_at = NOW() WHERE id = $2 AND event_id = $3',
      [remaining?.status ?? 'pending', target.guest_id, eventId]
    );
  }
  return true;
}

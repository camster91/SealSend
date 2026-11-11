import { z } from 'zod';
import { SQL_NOW, type Statement } from '@/lib/db/sqlite-dialect';

export const checkInSchema = z.object({
  guestId: z.string().uuid().optional(),
  inviteToken: z.string().min(16).max(512).optional(),
  rsvpResponseId: z.string().uuid().optional(),
  checkedIn: z.boolean(),
}).strict().refine((value) => [value.guestId, value.inviteToken, value.rsvpResponseId].filter(Boolean).length === 1, 'Provide exactly one attendee identifier');

export type CheckInGuest = {
  id: string; name: string; rsvp_status: string; checked_in_at: string | null;
  source: 'guest' | 'public_rsvp'; headcount: number;
};
type Db = { query<T>(text: string, params?: unknown[]): Promise<T[]> };

export async function listCheckInGuests(db: Db, eventId: string): Promise<CheckInGuest[]> {
  return db.query<CheckInGuest>(`SELECT * FROM (
    SELECT g.id, g.name, g.rsvp_status, g.checked_in_at, 'guest' AS source,
      COALESCE((SELECT r.headcount FROM rsvp_responses r WHERE r.event_id = $1 AND r.guest_id = g.id ORDER BY r.updated_at DESC NULLS LAST, r.id DESC LIMIT 1), 1) AS headcount
      FROM guests g WHERE g.event_id = $1
    UNION ALL
    SELECT id, respondent_name AS name, status AS rsvp_status, checked_in_at,
      'public_rsvp' AS source, headcount
      FROM rsvp_responses WHERE event_id = $1 AND guest_id IS NULL
  ) attendees ORDER BY checked_in_at DESC NULLS LAST, name ASC, id ASC LIMIT 1000`, [eventId]);
}

/**
 * The check-in UPDATE as a batch statement, so the route can run it after its audit insert in one
 * atomic batch. Caller supplies verified host access.
 */
export function updateCheckInGuestStatement(eventId: string, actorId: string, input: z.infer<typeof checkInSchema>): Statement {
  const publicResponse = Boolean(input.rsvpResponseId);
  const table = publicResponse ? 'rsvp_responses' : 'guests';
  const identifierClause = input.inviteToken ? 'invite_token = $1' : 'id = $1';
  const name = publicResponse ? 'respondent_name' : 'name';
  const status = publicResponse ? 'status' : 'rsvp_status';
  const headcount = publicResponse ? 'headcount' : 'COALESCE((SELECT r.headcount FROM rsvp_responses r WHERE r.event_id = $2 AND r.guest_id = guests.id ORDER BY r.updated_at DESC NULLS LAST, r.id DESC LIMIT 1), 1)';
  return {
    text: `UPDATE ${table}
    SET checked_in_at = CASE WHEN $3 THEN COALESCE(checked_in_at, ${SQL_NOW}) ELSE NULL END,
      checked_in_by = CASE WHEN $3 THEN COALESCE(checked_in_by, $4) ELSE NULL END, updated_at = ${SQL_NOW}
    WHERE ${identifierClause} AND event_id = $2 ${publicResponse ? 'AND guest_id IS NULL' : ''}
    RETURNING id, ${name} AS name, ${status} AS rsvp_status, checked_in_at,
      '${publicResponse ? 'public_rsvp' : 'guest'}' AS source, ${headcount} AS headcount`,
    params: [input.rsvpResponseId ?? input.guestId ?? input.inviteToken, eventId, input.checkedIn, actorId],
  };
}

/** Runs the check-in UPDATE on its own. Caller supplies verified host access. */
export async function updateCheckInGuest(db: Db, eventId: string, actorId: string, input: z.infer<typeof checkInSchema>): Promise<CheckInGuest | null> {
  const { text, params } = updateCheckInGuestStatement(eventId, actorId, input);
  return (await db.query<CheckInGuest>(text, params))[0] ?? null;
}

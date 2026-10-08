import { z } from 'zod';

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
type Query = <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }>;

export async function listCheckInGuests(db: Query, eventId: string): Promise<CheckInGuest[]> {
  return (await db<CheckInGuest>(`SELECT * FROM (
    SELECT g.id, g.name, g.rsvp_status, g.checked_in_at, 'guest'::text AS source,
      COALESCE((SELECT r.headcount FROM rsvp_responses r WHERE r.event_id = $1 AND r.guest_id = g.id ORDER BY r.updated_at DESC NULLS LAST, r.id DESC LIMIT 1), 1) AS headcount
      FROM guests g WHERE g.event_id = $1
    UNION ALL
    SELECT id, respondent_name AS name, status AS rsvp_status, checked_in_at,
      'public_rsvp'::text AS source, headcount
      FROM rsvp_responses WHERE event_id = $1 AND guest_id IS NULL
  ) attendees ORDER BY checked_in_at DESC NULLS LAST, name ASC, id ASC LIMIT 1000`, [eventId])).rows;
}

/** Caller supplies verified host access and owns the transaction/audit commit. */
export async function updateCheckInGuest(db: Query, eventId: string, actorId: string, input: z.infer<typeof checkInSchema>): Promise<CheckInGuest | null> {
  const publicResponse = Boolean(input.rsvpResponseId);
  const table = publicResponse ? 'rsvp_responses' : 'guests';
  const identifierClause = input.inviteToken ? 'invite_token = $1' : 'id = $1';
  const name = publicResponse ? 'respondent_name' : 'name';
  const status = publicResponse ? 'status' : 'rsvp_status';
  return (await db<CheckInGuest>(`UPDATE ${table}
    SET checked_in_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
      checked_in_by = CASE WHEN $3 THEN $4::uuid ELSE NULL END, updated_at = NOW()
    WHERE ${identifierClause} AND event_id = $2 ${publicResponse ? 'AND guest_id IS NULL' : ''}
    RETURNING id, ${name} AS name, ${status} AS rsvp_status, checked_in_at,
      '${publicResponse ? 'public_rsvp' : 'guest'}'::text AS source, ${publicResponse ? 'headcount' : '1'} AS headcount`,
  [input.rsvpResponseId ?? input.guestId ?? input.inviteToken, eventId, input.checkedIn, actorId])).rows[0] ?? null;
}

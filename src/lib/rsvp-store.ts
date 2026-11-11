import { randomUUID } from 'node:crypto';
import { hashMagicToken } from './magic-token';
import { SQL_NOW, abortCode, guard, type Statement } from './db/sqlite-dialect';
import type { batch, query } from './db/client';
import type { RSVPSubmissionInput } from './validations';
import type { RSVPResponse } from '@/types/database';

/** Routes pass `{ query, batch }` from @/lib/db/client; tests pass `openTestDb()`. */
export type RsvpDb = { query: typeof query; batch: typeof batch };
export class RsvpError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
// Deliberately omit edit_token_hash from every API-facing projection.
const responseColumns = 'id, event_id, guest_id, respondent_name, respondent_email, status, headcount, response_data, plus_ones_data, submitted_at';
// Guard code for "something this save read has changed since": the save is retried from the reads.
export const RSVP_CHANGED = 'rsvp_changed';
const MAX_ATTEMPTS = 3;

export async function findRsvp(db: RsvpDb, eventId: string, guestId: string | null, editToken?: string): Promise<RSVPResponse | null> {
  if (guestId) {
    return (await db.query<RSVPResponse>(`SELECT ${responseColumns} FROM rsvp_responses WHERE event_id = $1 AND guest_id = $2 ORDER BY updated_at DESC, submitted_at DESC, id DESC LIMIT 1`, [eventId, guestId]))[0] ?? null;
  }
  if (!editToken) return null;
  const row = (await db.query<RSVPResponse>(`SELECT ${responseColumns} FROM rsvp_responses WHERE edit_token_hash = $1`, [hashMagicToken(editToken)]))[0];
  if (row && (row.event_id !== eventId || row.guest_id)) throw new RsvpError('Invalid response access.');
  return row ?? null;
}

const attendingTotalSql = "SELECT COALESCE(SUM(headcount), 0) FROM rsvp_responses WHERE event_id = $1 AND status = 'attending' AND ($2 IS NULL OR id <> $2)";

async function attendingTotal(db: RsvpDb, eventId: string, excludeId: string | null): Promise<number> {
  return Number((await db.query<{ total: number }>(`SELECT (${attendingTotalSql}) AS total`, [eventId, excludeId]))[0]?.total ?? 0);
}

function capacityError(maxAttendees: number, total: number): RsvpError {
  const left = Math.max(0, maxAttendees - total);
  return new RsvpError(left ? `Only ${left} spots remaining. Please reduce your guest count.` : 'This event has reached its maximum number of attendees.');
}

export type SaveRsvpOptions = {
  /**
   * Extra validation that runs with the other reads on every attempt (e.g. custom fields).
   * Throw an RsvpError to reject; return guards (use RSVP_CHANGED) to re-check what it read.
   */
  validate?: (previous: RSVPResponse | null) => Promise<Statement[] | void>;
};

/**
 * Identity must already be verified. Reads and validates first, then writes in one batch whose
 * guards re-check everything the reads relied on (D1 has no locks): a lost race on the plan limit
 * or capacity fails like the up-front check, and a changed event or response retries the save.
 */
export async function saveRsvp(db: RsvpDb, eventId: string, guestId: string | null, editToken: string | undefined, input: RSVPSubmissionInput, responseLimit: number | null, options: SaveRsvpOptions = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptSaveRsvp(db, eventId, guestId, editToken, input, responseLimit, options);
    } catch (error) {
      if (abortCode(error) !== RSVP_CHANGED) throw error;
      if (attempt >= MAX_ATTEMPTS) throw new RsvpError('Your response could not be saved. Please try again.', 409);
    }
  }
}

async function attemptSaveRsvp(db: RsvpDb, eventId: string, guestId: string | null, editToken: string | undefined, input: RSVPSubmissionInput, responseLimit: number | null, options: SaveRsvpOptions) {
  const row = (await db.query<{ status: string; max_attendees: number | null; allow_plus_ones: boolean | null; max_guests_per_rsvp: number | null; deadline_passed: number | null }>(`SELECT status, max_attendees, allow_plus_ones, max_guests_per_rsvp, (rsvp_deadline <= ${SQL_NOW}) AS deadline_passed FROM events WHERE id = $1`, [eventId]))[0];
  if (!row || row.status !== 'published') throw new RsvpError('Event not found or not published', 404);
  const event = { ...row, deadline_passed: Boolean(row.deadline_passed) };
  const previous = await findRsvp(db, eventId, guestId, editToken);
  if (!previous && event.deadline_passed) throw new RsvpError('The RSVP deadline has passed. New responses are closed.');
  const extraGuards = (await options.validate?.(previous)) ?? [];
  const headcount = event.allow_plus_ones === false ? 1 : input.headcount;
  const maxPerRsvp = event.max_guests_per_rsvp || 10;
  if (headcount > maxPerRsvp) throw new RsvpError(`Maximum ${maxPerRsvp} guests per RSVP.`, 400);
  if (input.plus_ones.length > headcount - 1) throw new RsvpError(`You can only add ${headcount - 1} additional guests.`, 400);
  const checkLimit = !previous && Boolean(responseLimit);
  if (checkLimit) {
    const count = Number((await db.query<{ count: number }>('SELECT COUNT(*) AS count FROM rsvp_responses WHERE event_id = $1', [eventId]))[0].count);
    if (count >= responseLimit!) throw new RsvpError('This event has reached its maximum number of responses. The host may need to upgrade their plan.');
  }
  const checkCapacity = Boolean(event.max_attendees) && input.status === 'attending';
  if (checkCapacity) {
    const total = await attendingTotal(db, eventId, previous?.id ?? null);
    if (total + headcount > event.max_attendees!) throw capacityError(event.max_attendees!, total);
  }

  const editTokenHash = !guestId && editToken ? hashMagicToken(editToken) : null;
  const statements: Statement[] = [
    // The event settings the checks above used are unchanged and it is still published.
    guard(
      "EXISTS (SELECT 1 FROM events WHERE id = $1 AND status = 'published' AND max_attendees IS $2 AND allow_plus_ones IS $3 AND max_guests_per_rsvp IS $4)",
      [eventId, event.max_attendees, event.allow_plus_ones, event.max_guests_per_rsvp], RSVP_CHANGED,
    ),
    previous
      // The response being edited still exists (a host may have deleted it).
      ? guard('EXISTS (SELECT 1 FROM rsvp_responses WHERE id = $1 AND event_id = $2)', [previous.id, eventId], RSVP_CHANGED)
      // No response appeared for this guest or edit token since the read (that one is edited instead).
      : guard(
        `NOT EXISTS (SELECT 1 FROM rsvp_responses WHERE (event_id = $1 AND guest_id = $2) OR edit_token_hash = $3)
         AND NOT EXISTS (SELECT 1 FROM events WHERE id = $1 AND rsvp_deadline <= ${SQL_NOW})`,
        [eventId, guestId, editTokenHash], RSVP_CHANGED,
      ),
    ...extraGuards,
  ];
  if (checkLimit) statements.push(guard('(SELECT COUNT(*) FROM rsvp_responses WHERE event_id = $1) < $2', [eventId, responseLimit], 'response_limit'));
  if (checkCapacity) statements.push(guard(`(${attendingTotalSql}) + $3 <= $4`, [eventId, previous?.id ?? null, headcount, event.max_attendees], 'capacity'));

  const responseId = previous?.id ?? randomUUID();
  const values = [eventId, input.respondent_name, input.respondent_email || null, input.status, headcount, input.response_data, input.plus_ones];
  const responseIndex = statements.length;
  if (previous) {
    statements.push(
      { text: `UPDATE rsvp_responses SET respondent_name = $2, respondent_email = $3, status = $4, headcount = $5, response_data = $6, plus_ones_data = $7, updated_at = ${SQL_NOW} WHERE event_id = $1 AND id = $8 RETURNING ${responseColumns}`, params: [...values, responseId] },
      { text: 'DELETE FROM plus_ones WHERE rsvp_response_id = $1', params: [responseId] },
    );
  } else {
    statements.push({ text: `INSERT INTO rsvp_responses (event_id, respondent_name, respondent_email, status, headcount, response_data, plus_ones_data, guest_id, edit_token_hash, id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${responseColumns}`, params: [...values, guestId, editTokenHash, responseId] });
  }
  for (const po of input.plus_ones) {
    statements.push({ text: 'INSERT INTO plus_ones (event_id, rsvp_response_id, name, email, status) VALUES ($1,$2,$3,$4,$5)', params: [eventId, responseId, po.name, po.email || null, input.status] });
  }
  if (guestId) statements.push({ text: `UPDATE guests SET rsvp_status = $1, updated_at = ${SQL_NOW} WHERE id = $2 AND event_id = $3`, params: [input.status, guestId, eventId] });

  let results: unknown[][];
  try {
    results = await db.batch(statements);
  } catch (error) {
    const code = abortCode(error);
    if (code === 'response_limit') throw new RsvpError('This event has reached its maximum number of responses. The host may need to upgrade their plan.');
    if (code === 'capacity') throw capacityError(event.max_attendees!, await attendingTotal(db, eventId, previous?.id ?? null));
    throw error;
  }
  const response = results[responseIndex][0] as RSVPResponse;
  return { response, updated: Boolean(previous) };
}

/**
 * Delete a host-managed response while keeping the invited guest's denormalized
 * RSVP status in sync. Both writes run in one batch, so a concurrent public reply
 * (also a single batch) is either fully before or fully after this delete.
 */
export async function deleteRsvp(db: Pick<RsvpDb, 'batch'>, eventId: string, responseId: string): Promise<boolean> {
  const [, deleted] = await db.batch<{ id: string }>([
    // Recalculate from the remaining responses before the row goes; no-op when it has no guest.
    {
      text: `UPDATE guests SET rsvp_status = COALESCE((
          SELECT status FROM rsvp_responses
          WHERE event_id = $1 AND guest_id = guests.id AND id <> $2
          ORDER BY updated_at DESC, submitted_at DESC, id DESC
          LIMIT 1
        ), 'pending'), updated_at = ${SQL_NOW}
        WHERE event_id = $1 AND id = (SELECT guest_id FROM rsvp_responses WHERE id = $2 AND event_id = $1)`,
      params: [eventId, responseId],
    },
    { text: 'DELETE FROM rsvp_responses WHERE id = $2 AND event_id = $1 RETURNING id', params: [eventId, responseId] },
  ]);
  return deleted.length > 0;
}

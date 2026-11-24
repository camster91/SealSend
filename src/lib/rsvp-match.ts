import { randomUUID } from "node:crypto";
import { abortCode, guard, SQL_NOW, type Statement } from "@/lib/db/sqlite-dialect";
import type { RsvpDb } from "@/lib/rsvp-store";

export type UnmatchedReply = {
  id: string;
  respondent_name: string;
  respondent_email: string | null;
  status: string;
  headcount: number;
  suggested_guest_id: string | null;
  suggested_guest_name: string | null;
};

/**
 * Replies from the shared link, each with the one guest it might be. Only a suggestion:
 * anyone can type someone else's email, so the host decides.
 */
export async function listUnmatchedReplies(db: Pick<RsvpDb, "query">, eventId: string): Promise<UnmatchedReply[]> {
  return db.query<UnmatchedReply>(
    `SELECT r.id, r.respondent_name, r.respondent_email, r.status, r.headcount, g.id AS suggested_guest_id, g.name AS suggested_guest_name
       FROM rsvp_responses r
       LEFT JOIN guests g ON g.id = (
         SELECT c.id FROM guests c
          WHERE c.event_id = r.event_id AND c.parent_guest_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM rsvp_responses taken WHERE taken.event_id = r.event_id AND taken.guest_id = c.id)
            AND ((c.email IS NOT NULL AND LOWER(TRIM(c.email)) = LOWER(TRIM(r.respondent_email)))
                 OR LOWER(TRIM(c.name)) = LOWER(TRIM(r.respondent_name)))
          ORDER BY (c.email IS NOT NULL AND LOWER(TRIM(c.email)) = LOWER(TRIM(r.respondent_email))) DESC, c.created_at, c.id LIMIT 1)
      WHERE r.event_id = $1 AND r.guest_id IS NULL
      ORDER BY r.submitted_at DESC, r.id LIMIT 500`,
    [eventId],
  );
}

type MatchInput = { eventId: string; responseId: string; actorId: string };

function matchStatements({ eventId, responseId, actorId }: MatchInput, guestId: string): Statement[] {
  return [
    guard("EXISTS (SELECT 1 FROM rsvp_responses WHERE id = $1 AND event_id = $2 AND guest_id IS NULL)", [responseId, eventId], "reply_unavailable"),
    guard("EXISTS (SELECT 1 FROM guests WHERE id = $1 AND event_id = $2)", [guestId, eventId], "guest_unavailable"),
    guard("NOT EXISTS (SELECT 1 FROM rsvp_responses WHERE event_id = $1 AND guest_id = $2)", [eventId, guestId], "guest_replied"),
    {
      // Keep an arrival already recorded against the reply.
      text: `UPDATE guests SET
               rsvp_status = (SELECT status FROM rsvp_responses WHERE id = $1),
               checked_in_at = COALESCE(checked_in_at, (SELECT checked_in_at FROM rsvp_responses WHERE id = $1)),
               checked_in_by = COALESCE(checked_in_by, (SELECT checked_in_by FROM rsvp_responses WHERE id = $1)),
               updated_at = ${SQL_NOW}
             WHERE id = $2 AND event_id = $3`,
      params: [responseId, guestId, eventId],
    },
    { text: `UPDATE rsvp_responses SET guest_id = $1, updated_at = ${SQL_NOW} WHERE id = $2 AND event_id = $3`, params: [guestId, responseId, eventId] },
    {
      text: "INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata) VALUES ($1, $2, 'rsvp_matched', $3)",
      params: [eventId, actorId, JSON.stringify({ responseId, guestId })],
    },
  ];
}

/** Returns an error message, or null when the reply is now the guest's. */
async function run(db: Pick<RsvpDb, "batch">, statements: Statement[]): Promise<string | null> {
  try {
    await db.batch(statements);
    return null;
  } catch (error) {
    const code = abortCode(error);
    if (code === "guest_replied") return "That guest has already replied.";
    if (code === "email_listed") return "Someone with this email is already on your guest list.";
    if (code === "guest_limit") return "Your guest list is full.";
    if (code) return "This reply changed. Refresh and try again.";
    throw error;
  }
}

export function matchReplyToGuest(db: Pick<RsvpDb, "batch">, input: MatchInput, guestId: string) {
  return run(db, matchStatements(input, guestId));
}

export function addReplyAsGuest(db: Pick<RsvpDb, "batch">, input: MatchInput, guestLimit: number) {
  const guestId = randomUUID();
  const { eventId, responseId } = input;
  const [replyGuard, ...rest] = matchStatements(input, guestId);
  return run(db, [
    replyGuard,
    guard("(SELECT COUNT(*) FROM guests WHERE event_id = $1) < $2", [eventId, guestLimit], "guest_limit"),
    guard(
      `NOT EXISTS (SELECT 1 FROM guests g JOIN rsvp_responses r ON r.id = $2
         WHERE g.event_id = $1 AND g.email IS NOT NULL AND LOWER(TRIM(g.email)) = LOWER(TRIM(r.respondent_email)))`,
      [eventId, responseId],
      "email_listed",
    ),
    {
      text: `INSERT INTO guests (id, event_id, name, email)
             SELECT $1, event_id, TRIM(respondent_name), NULLIF(LOWER(TRIM(COALESCE(respondent_email, ''))), '') FROM rsvp_responses WHERE id = $2 AND event_id = $3`,
      params: [guestId, responseId, eventId],
    },
    ...rest,
  ]);
}

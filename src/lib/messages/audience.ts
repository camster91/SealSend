import { z } from "zod";

export const messageAudienceSchema = z.object({
  rsvpStatuses: z.array(z.enum(["pending", "attending", "not_attending", "maybe"])).max(4).default([]),
  invitationStatuses: z.array(z.enum(["not_sent", "pending", "sent", "delivered", "bounced", "failed", "accepted"])).max(7).default([]),
  tagIds: z.array(z.string().uuid()).max(50).default([]),
  unansweredOnly: z.boolean().default(false),
}).strict();

export type MessageAudience = z.infer<typeof messageAudienceSchema>;

export function buildAudienceQuery(eventId: string, audience: MessageAudience) {
  const clauses = ["g.event_id = $1", "(g.email IS NOT NULL OR g.phone IS NOT NULL)"];
  const params: unknown[] = [eventId];
  if (audience.rsvpStatuses.length) {
    params.push(audience.rsvpStatuses);
    clauses.push(`g.rsvp_status = ANY($${params.length}::text[])`);
  }
  if (audience.invitationStatuses.length) {
    params.push(audience.invitationStatuses);
    clauses.push(`g.invite_status = ANY($${params.length}::text[])`);
  }
  if (audience.tagIds.length) {
    params.push(audience.tagIds);
    clauses.push(`EXISTS (
      SELECT 1 FROM guest_tag_assignments gta
      WHERE gta.guest_id = g.id AND gta.tag_id = ANY($${params.length}::uuid[])
    )`);
  }
  if (audience.unansweredOnly) {
    clauses.push(`NOT EXISTS (
      SELECT 1 FROM rsvp_responses rr
      WHERE rr.event_id = g.event_id
        AND (rr.guest_id = g.id OR (g.email IS NOT NULL AND LOWER(rr.respondent_email) = LOWER(g.email)))
    )`);
  }
  return {
    sql: `SELECT g.id, g.name, g.email, g.phone, g.invite_token
      FROM guests g WHERE ${clauses.join(" AND ")} ORDER BY g.name ASC`,
    params,
  };
}

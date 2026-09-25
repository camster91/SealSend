import { z } from "zod";
import { queryOne } from "@/lib/db/client";
import { hashMagicToken, isValidMagicToken } from "@/lib/magic-token";

const optionalTrimmed = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(120),
  contactEmail: z.string().trim().email("Enter a valid email").max(254).nullable().optional().or(z.literal("").transform(() => null)),
  contactPhone: optionalTrimmed(40),
  notes: optionalTrimmed(2000),
}).strict();
export type ClientInput = z.infer<typeof clientInputSchema>;

export const CLIENT_SHARE_LIFETIME_DAYS = 30;

export type ClientShareView = {
  shareId: string;
  eventId: string;
  title: string;
  eventDate: string | null;
  eventTimezone: string;
  locationName: string | null;
  hostName: string | null;
  invitationHeadline: string | null;
  invitationBody: string | null;
  designUrl: string | null;
  status: string;
  clientName: string | null;
  approvedAt: string | null;
  approverName: string | null;
  expiresAt: string;
  rsvp: { invited: number; attending: number; maybe: number; declined: number; awaiting: number; headcount: number };
};

type ShareRow = {
  share_id: string; event_id: string; title: string; event_date: string | null; event_timezone: string;
  location_name: string | null; host_name: string | null; invitation_headline: string | null; invitation_body: string | null;
  design_url: string | null; status: string; client_name: string | null; approved_at: string | null; approver_name: string | null;
  expires_at: string; invited: string; attending: string; maybe: string; declined: string; headcount: string;
};

/** Summarizes RSVP totals only: a client link never exposes guest names or contact details. */
export function toClientShareView(row: ShareRow): ClientShareView {
  const invited = Number(row.invited);
  const attending = Number(row.attending);
  const maybe = Number(row.maybe);
  const declined = Number(row.declined);
  return {
    shareId: row.share_id,
    eventId: row.event_id,
    title: row.title,
    eventDate: row.event_date,
    eventTimezone: row.event_timezone,
    locationName: row.location_name,
    hostName: row.host_name,
    invitationHeadline: row.invitation_headline,
    invitationBody: row.invitation_body,
    designUrl: row.design_url,
    status: row.status,
    clientName: row.client_name,
    approvedAt: row.approved_at,
    approverName: row.approver_name,
    expiresAt: row.expires_at,
    rsvp: { invited, attending, maybe, declined, awaiting: Math.max(0, invited - attending - maybe - declined), headcount: Number(row.headcount) },
  };
}

export async function getClientShareView(token: string): Promise<ClientShareView | null> {
  if (!isValidMagicToken(token)) return null;
  const row = await queryOne<ShareRow>(
    `SELECT s.id AS share_id, e.id AS event_id, e.title, e.event_date, e.event_timezone, e.location_name, e.host_name,
            e.invitation_headline, e.invitation_body, e.design_url, e.status, c.name AS client_name,
            s.approved_at, s.approver_name, s.expires_at,
            (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id)::text AS invited,
            (SELECT COUNT(*) FROM rsvp_responses r WHERE r.event_id = e.id AND r.status = 'attending')::text AS attending,
            (SELECT COUNT(*) FROM rsvp_responses r WHERE r.event_id = e.id AND r.status = 'maybe')::text AS maybe,
            (SELECT COUNT(*) FROM rsvp_responses r WHERE r.event_id = e.id AND r.status = 'not_attending')::text AS declined,
            (SELECT COALESCE(SUM(r.headcount), 0) FROM rsvp_responses r WHERE r.event_id = e.id AND r.status = 'attending')::text AS headcount
       FROM event_client_shares s
       JOIN events e ON e.id = s.event_id
       LEFT JOIN clients c ON c.id = e.client_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
    [hashMagicToken(token)],
  );
  return row ? toClientShareView(row) : null;
}

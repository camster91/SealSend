import { z } from "zod";
import { query, queryOne } from "@/lib/db/client";
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

export type ClientEventHistoryItem = {
  id: string;
  title: string;
  eventDate: string | null;
  status: string;
  rsvp: ClientShareView["rsvp"];
  approvedAt: string | null;
  approverName: string | null;
};

type HistoryRow = {
  id: string; title: string; event_date: string | Date | null; status: string;
  invited: string; attending: string; maybe: string; declined: string; headcount: string;
  approved_at: string | Date | null; approver_name: string | null;
};

/** pg returns TIMESTAMPTZ as Date; keep history dates as ISO strings for JSON and CSV alike. */
function isoOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function toClientEventHistoryItem(row: HistoryRow): ClientEventHistoryItem {
  const invited = Number(row.invited);
  const attending = Number(row.attending);
  const maybe = Number(row.maybe);
  const declined = Number(row.declined);
  return {
    id: row.id,
    title: row.title,
    eventDate: isoOrNull(row.event_date),
    status: row.status,
    rsvp: { invited, attending, maybe, declined, awaiting: Math.max(0, invited - attending - maybe - declined), headcount: Number(row.headcount) },
    approvedAt: isoOrNull(row.approved_at),
    approverName: row.approver_name,
  };
}

/** Every event a workspace ran for one client, newest first, with RSVP totals and the latest client approval. */
export async function getClientEventHistory(organizationId: string, clientId: string): Promise<ClientEventHistoryItem[]> {
  const rows = await query<HistoryRow>(
    `SELECT e.id, e.title, e.event_date, e.status,
            (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id)::text AS invited,
            (SELECT COUNT(*) FROM rsvp_responses r WHERE r.event_id = e.id AND r.status = 'attending')::text AS attending,
            (SELECT COUNT(*) FROM rsvp_responses r WHERE r.event_id = e.id AND r.status = 'maybe')::text AS maybe,
            (SELECT COUNT(*) FROM rsvp_responses r WHERE r.event_id = e.id AND r.status = 'not_attending')::text AS declined,
            (SELECT COALESCE(SUM(r.headcount), 0) FROM rsvp_responses r WHERE r.event_id = e.id AND r.status = 'attending')::text AS headcount,
            approval.approved_at, approval.approver_name
       FROM events e
       LEFT JOIN LATERAL (
         SELECT s.approved_at, s.approver_name FROM event_client_shares s
          WHERE s.event_id = e.id AND s.approved_at IS NOT NULL
          ORDER BY s.approved_at DESC LIMIT 1
       ) approval ON TRUE
      WHERE e.client_id = $1 AND e.organization_id = $2
      ORDER BY e.event_date DESC NULLS LAST, e.created_at DESC`,
    [clientId, organizationId],
  );
  return rows.map(toClientEventHistoryItem);
}

export const CLIENT_HISTORY_CSV_HEADER = ["Event", "Date", "Status", "Invited", "Attending", "Maybe", "Declined", "Awaiting", "Headcount", "Approved by", "Approved at"] as const;

export function clientHistoryCsvRows(history: ClientEventHistoryItem[]): unknown[][] {
  return history.map((event) => [
    event.title,
    event.eventDate ?? "",
    event.status,
    event.rsvp.invited,
    event.rsvp.attending,
    event.rsvp.maybe,
    event.rsvp.declined,
    event.rsvp.awaiting,
    event.rsvp.headcount,
    event.approverName ?? "",
    event.approvedAt ?? "",
  ]);
}

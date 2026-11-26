import { NextResponse } from "next/server";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { query, queryOne } from "@/lib/db/client";
import { buildRsvpSummary, type SummaryField, type SummaryResponse } from "@/lib/rsvp-summary";
import { walkInCountSql } from "@/lib/event-stats";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventPermission(eventId, "export_responses");
  if (auth.error) return auth.error;
  const [event, responses, fields, walkIns] = await Promise.all([
    queryOne<{ max_attendees: number | null }>("SELECT max_attendees FROM events WHERE id = $1", [eventId]),
    query<SummaryResponse>("SELECT id, status, headcount, respondent_name, respondent_email, response_data, plus_ones_data FROM rsvp_responses WHERE event_id = $1 ORDER BY submitted_at", [eventId]),
    query<SummaryField>("SELECT field_name, field_label, field_type, is_required, per_person, options FROM rsvp_fields WHERE event_id = $1 AND is_enabled = TRUE ORDER BY sort_order", [eventId]),
    queryOne<{ count: number }>(
      `SELECT ${walkInCountSql('$1')} AS count`,
      [eventId],
    ),
  ]);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(buildRsvpSummary(responses, fields, event.max_attendees, Number(walkIns?.count ?? 0)), { headers: { "Cache-Control": "private, no-store" } });
}

import { NextResponse } from "next/server";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { query, queryOne } from "@/lib/db/client";
import { buildRsvpSummary, type SummaryField, type SummaryResponse } from "@/lib/rsvp-summary";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventPermission(eventId, "export_responses");
  if (auth.error) return auth.error;
  const [event, responses, fields] = await Promise.all([
    queryOne<{ max_attendees: number | null }>("SELECT max_attendees FROM events WHERE id = $1", [eventId]),
    query<SummaryResponse>("SELECT id, status, headcount, response_data FROM rsvp_responses WHERE event_id = $1 ORDER BY submitted_at", [eventId]),
    query<SummaryField>("SELECT field_name, field_label, field_type, is_required FROM rsvp_fields WHERE event_id = $1 AND is_enabled = TRUE ORDER BY sort_order", [eventId]),
  ]);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(buildRsvpSummary(responses, fields, event.max_attendees), { headers: { "Cache-Control": "private, no-store" } });
}

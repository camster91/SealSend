import { NextResponse } from "next/server";

import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { buildIcsCalendar } from "@/lib/calendar";
import { queryOne } from "@/lib/db/client";

interface CalendarRow {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  event_date: string;
  event_end_date: string | null;
  event_timezone: string;
  location_name: string | null;
  location_address: string | null;
  updated_at: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = await queryOne<CalendarRow>(
    `SELECT id, user_id, slug, title, description, event_date, event_end_date,
            event_timezone, location_name, location_address, updated_at
     FROM events
     WHERE slug = $1 AND status = 'published' AND event_date IS NOT NULL`,
    [slug],
  );

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const calendar = buildIcsCalendar({
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    eventDate: event.event_date,
    eventEndDate: event.event_end_date,
    eventTimezone: event.event_timezone,
    locationName: event.location_name,
    locationAddress: event.location_address,
    updatedAt: event.updated_at,
  });
  const filename = `sealsend-${event.slug.replace(/[^a-zA-Z0-9_-]/g, "-")}.ics`;
  await recordActivationEventSafely({
    name: "calendar_exported",
    userId: event.user_id,
    eventId: event.id,
  });

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

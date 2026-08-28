import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { getDb } from "@/lib/db/client";
import { canCreateEvent, getEffectiveEventLimits } from "@/lib/entitlements";
import { buildRepeatedEventBrief, parseRepeatEventRequest } from "@/lib/repeat-event";
import { getUserTier } from "@/lib/subscription";
import { generateSlug } from "@/lib/utils";

type RouteParams = { params: Promise<{ eventId: string }> };

type SourceEvent = {
  status: "draft" | "published" | "archived";
  description: string | null;
  invitation_headline: string | null;
  invitation_body: string | null;
  reminder_sequence: unknown;
  event_timezone: string;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  host_name: string | null;
  dress_code: string | null;
  registry_links: unknown;
  max_attendees: number | null;
  allow_plus_ones: boolean;
  max_guests_per_rsvp: number;
  design_url: string | null;
  design_type: string;
  customization: unknown;
  event_brief: unknown;
};

type SourceGuest = { id: string; name: string; email: string | null; phone: string | null; tags: unknown };
type SourceTag = { id: string; tag_name: string; color: string };
type SourceAssignment = { guest_id: string; tag_id: string };

function valuesSql(rowCount: number, columnCount: number): string {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const start = rowIndex * columnCount + 1;
    return `(${Array.from({ length: columnCount }, (__, columnIndex) => `$${start + columnIndex}`).join(", ")})`;
  }).join(", ");
}

export async function POST(request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const auth = await requireEventPermission(eventId, "clone_event");
  if (auth.error) return auth.error;

  let repeatRequest;
  try {
    repeatRequest = parseRepeatEventRequest(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid repeat-event request" },
      { status: 400 },
    );
  }

  const accountPlan = await getUserTier(auth.user.id);
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [auth.user.id]);

    const originalResult = await client.query<SourceEvent>(
      `SELECT status, description, invitation_headline, invitation_body, reminder_sequence, event_timezone,
              location_name, location_address, location_lat, location_lng, host_name, dress_code,
              registry_links, max_attendees, allow_plus_ones, max_guests_per_rsvp,
              design_url, design_type, customization, event_brief
       FROM events WHERE id = $1 AND user_id = $2`,
      [eventId, auth.user.id],
    );
    const original = originalResult.rows[0];
    if (!original) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    let sourceArchived = false;
    if (repeatRequest.archiveSource && original.status !== "archived") {
      await client.query(
        "UPDATE events SET status = 'archived' WHERE id = $1 AND user_id = $2",
        [eventId, auth.user.id],
      );
      sourceArchived = true;
    }

    const activeResult = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM events WHERE user_id = $1 AND status <> 'archived'",
      [auth.user.id],
    );
    if (!canCreateEvent(accountPlan, Number(activeResult.rows[0]?.count ?? 0))) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: original.status === "archived"
            ? "This plan already has another active event. Archive it before repeating this event."
            : "This plan supports one active event. Approve archiving the current event to create the next draft.",
          requiresArchive: original.status !== "archived",
        },
        { status: 409 },
      );
    }
    const repeatedEventBrief = buildRepeatedEventBrief(original.event_brief);

    const limits = getEffectiveEventLimits(accountPlan, "free");
    const insertedEvent = await client.query<{ id: string; title: string }>(
      `INSERT INTO events (
         user_id, title, slug, description, invitation_headline, invitation_body, reminder_sequence,
         event_date, event_end_date, event_timezone, location_name, location_address,
         location_lat, location_lng, host_name, dress_code, rsvp_deadline, registry_links,
         max_attendees, allow_plus_ones, max_guests_per_rsvp, design_url, design_type,
         customization, status, tier, max_responses, auto_reminders, reminder_sent_at, payment_id,
         event_brief, ai_generation_id, repeated_from_event_id
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21, $22, $23, $24, 'draft', 'free', $25, FALSE, NULL, NULL, $26, NULL, $27
       ) RETURNING id, title`,
      [
        auth.user.id, repeatRequest.title, generateSlug(repeatRequest.title), original.description,
        original.invitation_headline, original.invitation_body, original.reminder_sequence,
        repeatRequest.eventDate, repeatRequest.eventEndDate, original.event_timezone,
        original.location_name, original.location_address, original.location_lat, original.location_lng,
        original.host_name, original.dress_code, repeatRequest.rsvpDeadline, original.registry_links,
        original.max_attendees, original.allow_plus_ones, original.max_guests_per_rsvp,
        original.design_url, original.design_type, original.customization, limits.responses,
        repeatedEventBrief ? JSON.stringify(repeatedEventBrief) : null,
        eventId,
      ],
    );
    const newEvent = insertedEvent.rows[0];

    await client.query(
      `INSERT INTO rsvp_fields
         (event_id, field_name, field_type, field_label, is_required, is_enabled, sort_order, options, placeholder)
       SELECT $1, field_name, field_type, field_label, is_required, is_enabled, sort_order, options, placeholder
       FROM rsvp_fields WHERE event_id = $2`,
      [newEvent.id, eventId],
    );
    await client.query(
      `INSERT INTO event_signup_items (event_id, title, description, category, slots, sort_order)
       SELECT $1, title, description, category, slots, sort_order
       FROM event_signup_items WHERE event_id = $2`,
      [newEvent.id, eventId],
    );

    let copiedGuestCount = 0;
    if (repeatRequest.includeGuests) {
      const guestResult = await client.query<SourceGuest>(
        `SELECT id, name, email, phone, tags FROM guests
         WHERE event_id = $1 AND COALESCE(is_plus_one, FALSE) = FALSE ORDER BY created_at ASC`,
        [eventId],
      );
      if (guestResult.rows.length > limits.guests) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `This plan can repeat at most ${limits.guests} guests.` },
          { status: 403 },
        );
      }

      const tagResult = await client.query<SourceTag>(
        "SELECT id, tag_name, color FROM guest_tags WHERE event_id = $1 ORDER BY created_at ASC",
        [eventId],
      );
      const assignmentResult = await client.query<SourceAssignment>(
        `SELECT assignment.guest_id, assignment.tag_id
         FROM guest_tag_assignments assignment
         JOIN guests ON guests.id = assignment.guest_id
         JOIN guest_tags ON guest_tags.id = assignment.tag_id
         WHERE guests.event_id = $1 AND guest_tags.event_id = $1`,
        [eventId],
      );

      const guestIds = new Map(guestResult.rows.map((guest) => [guest.id, randomUUID()]));
      const tagIds = new Map(tagResult.rows.map((tag) => [tag.id, randomUUID()]));
      if (tagResult.rows.length > 0) {
        await client.query(
          `INSERT INTO guest_tags (id, event_id, tag_name, color) VALUES ${valuesSql(tagResult.rows.length, 4)}`,
          tagResult.rows.flatMap((tag) => [tagIds.get(tag.id), newEvent.id, tag.tag_name, tag.color]),
        );
      }
      if (guestResult.rows.length > 0) {
        await client.query(
          `INSERT INTO guests (id, event_id, name, email, phone, tags)
           VALUES ${valuesSql(guestResult.rows.length, 6)}`,
          guestResult.rows.flatMap((guest) => [
            guestIds.get(guest.id), newEvent.id, guest.name, guest.email, guest.phone, guest.tags,
          ]),
        );
      }

      const copiedAssignments = assignmentResult.rows.flatMap((assignment) => {
        const guestId = guestIds.get(assignment.guest_id);
        const tagId = tagIds.get(assignment.tag_id);
        return guestId && tagId ? [[guestId, tagId]] : [];
      });
      if (copiedAssignments.length > 0) {
        await client.query(
          `INSERT INTO guest_tag_assignments (guest_id, tag_id)
           VALUES ${valuesSql(copiedAssignments.length, 2)}`,
          copiedAssignments.flat(),
        );
      }
      copiedGuestCount = guestResult.rows.length;
    }

    await client.query("COMMIT");
    await recordActivationEventSafely({
      name: "event_repeated",
      userId: auth.user.id,
      eventId: newEvent.id,
    });
    return NextResponse.json({ success: true, event: newEvent, copiedGuests: copiedGuestCount, sourceArchived }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Repeat event failed:", error);
    return NextResponse.json({ error: "Failed to repeat event" }, { status: 500 });
  } finally {
    client.release();
  }
}

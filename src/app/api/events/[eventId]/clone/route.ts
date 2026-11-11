import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { resolveEventAccessRole, roleCan } from "@/lib/auth/event-access";
import { batch, query, queryOne } from "@/lib/db/client";
import { abortCode, guard, type Statement } from "@/lib/db/sqlite-dialect";
import { canCreateEvent, getEffectiveEventLimits } from "@/lib/entitlements";
import { toTimestamp } from "@/lib/events";
import { buildRepeatedEventBrief, parseRepeatEventRequest } from "@/lib/repeat-event";
import { getUserTier } from "@/lib/subscription";
import { generateSlug } from "@/lib/utils";

type RouteParams = { params: Promise<{ eventId: string }> };

type SourceEvent = {
  id: string;
  user_id: string;
  organization_id: string | null;
  client_id: string | null;
  brand_id: string | null;
  role: string | null;
  organization_role: string | null;
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

  try {
    // D1 has no interactive transactions or locks: read and validate first, then write everything
    // in one batch whose guards re-check the owner and the per-owner active-event count (the check
    // event creation also guards). A concurrent create or repeat makes the count guard fail, and the
    // next attempt re-reads.
    for (let attempt = 0; attempt < 3; attempt++) {
      const original = await queryOne<SourceEvent>(
        `SELECT e.id, e.user_id, e.organization_id, e.client_id, e.brand_id,
                CASE WHEN e.user_id = $2 THEN 'owner'
                     ELSE (SELECT em.role FROM event_members em WHERE em.event_id = e.id AND em.user_id = $2 LIMIT 1)
                END AS role,
                (SELECT om.role FROM organization_members om WHERE om.organization_id = e.organization_id AND om.user_id = $2 LIMIT 1) AS organization_role,
                e.status, e.description, e.invitation_headline, e.invitation_body, e.reminder_sequence, e.event_timezone,
                location_name, location_address, location_lat, location_lng, host_name, dress_code,
                registry_links, max_attendees, allow_plus_ones, max_guests_per_rsvp,
                design_url, design_type, customization, event_brief
         FROM events e
         WHERE e.id = $1
           AND (e.user_id = $2
                OR EXISTS (SELECT 1 FROM event_members em WHERE em.event_id = e.id AND em.user_id = $2)
                OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = e.organization_id AND om.user_id = $2))`,
        [eventId, auth.user.id],
      );
      const transactionRole = original
        ? resolveEventAccessRole(original.role, original.organization_role)
        : null;
      if (!original || !transactionRole || !roleCan(transactionRole, "clone_event")) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      const accountPlan = await getUserTier(original.user_id);

      const sourceArchived = repeatRequest.archiveSource && original.status !== "archived";
      // Active events once the source is archived (when that was approved).
      const activeResult = await queryOne<{ count: number }>(
        "SELECT COUNT(*) AS count FROM events WHERE user_id = $1 AND status <> 'archived' AND NOT (id = $2 AND $3)",
        [original.user_id, eventId, sourceArchived],
      );
      const activeCount = Number(activeResult?.count ?? 0);
      if (!canCreateEvent(accountPlan, activeCount)) {
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

      let guests: SourceGuest[] = [];
      let tags: SourceTag[] = [];
      let assignments: SourceAssignment[] = [];
      if (repeatRequest.includeGuests) {
        guests = await query<SourceGuest>(
          `SELECT id, name, email, phone, tags FROM guests
           WHERE event_id = $1 AND COALESCE(is_plus_one, 0) = 0 ORDER BY created_at ASC`,
          [eventId],
        );
        if (guests.length > limits.guests) {
          return NextResponse.json(
            { error: `This plan can repeat at most ${limits.guests} guests.` },
            { status: 403 },
          );
        }
        tags = await query<SourceTag>(
          "SELECT id, tag_name, color FROM guest_tags WHERE event_id = $1 ORDER BY created_at ASC",
          [eventId],
        );
        assignments = await query<SourceAssignment>(
          `SELECT assignment.guest_id, assignment.tag_id
           FROM guest_tag_assignments assignment
           JOIN guests ON guests.id = assignment.guest_id
           JOIN guest_tags ON guest_tags.id = assignment.tag_id
           WHERE guests.event_id = $1 AND guest_tags.event_id = $1`,
          [eventId],
        );
      }

      const newEventId = randomUUID();
      const statements: Statement[] = [
        guard("EXISTS (SELECT 1 FROM events WHERE id = $1)", [eventId], "not_found"),
        // Account deletion can transfer the event between the read above and this batch.
        guard("(SELECT user_id FROM events WHERE id = $1) = $2", [eventId, original.user_id], "owner_changed"),
        guard(
          "(SELECT COUNT(*) FROM events WHERE user_id = $1 AND status <> 'archived' AND NOT (id = $2 AND $3)) <= $4",
          [original.user_id, eventId, sourceArchived, activeCount],
          "event_count_changed",
        ),
      ];
      if (sourceArchived) {
        statements.push({ text: "UPDATE events SET status = 'archived' WHERE id = $1", params: [eventId] });
      }
      const insertEventIndex = statements.length;
      statements.push({
        text: `INSERT INTO events (
           id, user_id, title, slug, description, invitation_headline, invitation_body, reminder_sequence,
           event_date, event_end_date, event_timezone, location_name, location_address,
           location_lat, location_lng, host_name, dress_code, rsvp_deadline, registry_links,
           max_attendees, allow_plus_ones, max_guests_per_rsvp, design_url, design_type,
           customization, status, tier, max_responses, auto_reminders, reminder_sent_at, payment_id,
           event_brief, ai_generation_id, repeated_from_event_id, organization_id, client_id, brand_id
         ) VALUES (
           $31, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
           $17, $18, $19, $20, $21, $22, $23, $24, 'draft', 'free', $25, 0, NULL, NULL, $26, NULL, $27, $28, $29, $30
         ) RETURNING id, title`,
        params: [
          original.user_id, repeatRequest.title, generateSlug(repeatRequest.title), original.description,
          original.invitation_headline, original.invitation_body, original.reminder_sequence,
          toTimestamp(repeatRequest.eventDate), toTimestamp(repeatRequest.eventEndDate), original.event_timezone,
          original.location_name, original.location_address, original.location_lat, original.location_lng,
          original.host_name, original.dress_code, toTimestamp(repeatRequest.rsvpDeadline), JSON.stringify(original.registry_links ?? []),
          original.max_attendees, original.allow_plus_ones, original.max_guests_per_rsvp,
          original.design_url, original.design_type, original.customization, limits.responses,
          repeatedEventBrief ? JSON.stringify(repeatedEventBrief) : null,
          eventId,
          original.organization_id, original.client_id, original.brand_id,
          newEventId,
        ],
      });
      statements.push({
        text: `INSERT INTO rsvp_fields
           (event_id, field_name, field_type, field_label, is_required, is_enabled, sort_order, options, placeholder)
         SELECT $1, field_name, field_type, field_label, is_required, is_enabled, sort_order, options, placeholder
         FROM rsvp_fields WHERE event_id = $2`,
        params: [newEventId, eventId],
      });
      statements.push({
        text: `INSERT INTO event_signup_items (event_id, title, description, category, slots, sort_order)
         SELECT $1, title, description, category, slots, sort_order
         FROM event_signup_items WHERE event_id = $2`,
        params: [newEventId, eventId],
      });

      if (repeatRequest.includeGuests) {
        const guestIds = new Map(guests.map((guest) => [guest.id, randomUUID()]));
        const tagIds = new Map(tags.map((tag) => [tag.id, randomUUID()]));
        // Rows go in as one JSON parameter each (D1 allows 100 bound parameters per statement).
        if (tags.length > 0) {
          statements.push({
            text: `INSERT INTO guest_tags (id, event_id, tag_name, color)
             SELECT json_extract(value, '$[0]'), $1, json_extract(value, '$[1]'), json_extract(value, '$[2]')
             FROM json_each($2) WHERE true`,
            params: [newEventId, tags.map((tag) => [tagIds.get(tag.id), tag.tag_name, tag.color])],
          });
        }
        if (guests.length > 0) {
          statements.push({
            text: `INSERT INTO guests (id, event_id, name, email, phone, tags)
             SELECT json_extract(value, '$.id'), $1, json_extract(value, '$.name'), json_extract(value, '$.email'),
                    json_extract(value, '$.phone'), json(json_extract(value, '$.tags'))
             FROM json_each($2) ORDER BY key`,
            params: [
              newEventId,
              guests.map((guest) => ({ id: guestIds.get(guest.id), name: guest.name, email: guest.email, phone: guest.phone, tags: guest.tags })),
            ],
          });
        }

        const copiedAssignments = assignments.flatMap((assignment) => {
          const guestId = guestIds.get(assignment.guest_id);
          const tagId = tagIds.get(assignment.tag_id);
          return guestId && tagId ? [[guestId, tagId]] : [];
        });
        if (copiedAssignments.length > 0) {
          statements.push({
            text: `INSERT INTO guest_tag_assignments (guest_id, tag_id)
             SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each($1)`,
            params: [copiedAssignments],
          });
        }
      }

      let newEvent: { id: string; title: string };
      try {
        const results = await batch<{ id: string; title: string }>(statements);
        newEvent = results[insertEventIndex][0];
      } catch (error) {
        const code = abortCode(error);
        if (code === "not_found") return NextResponse.json({ error: "Event not found" }, { status: 404 });
        if (code === "owner_changed") return NextResponse.json({ error: "The event owner changed. Please retry." }, { status: 409 });
        if (code === "event_count_changed") continue;
        throw error;
      }

      await recordActivationEventSafely({
        name: "event_repeated",
        userId: auth.user.id,
        eventId: newEvent.id,
      });
      return NextResponse.json({ success: true, event: newEvent, copiedGuests: guests.length, sourceArchived }, { status: 201 });
    }
    throw new Error("Repeat event lost the active-event race three times");
  } catch (error) {
    console.error("Repeat event failed:", error);
    return NextResponse.json({ error: "Failed to repeat event" }, { status: 500 });
  }
}

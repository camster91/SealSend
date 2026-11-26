import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SQL_NOW, abortCode, guard, type Statement } from "./db/sqlite-dialect";
import type { batch, query } from "./db/client";
import type { EventSubEvent, HostSubEvent, VisibleSubEvent } from "./sub-event-types";

export type { EventSubEvent, HostSubEvent, SubEventVisibility, VisibleSubEvent } from "./sub-event-types";
export type SubEventDb = { query: typeof query; batch: typeof batch };

export class SubEventError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const optionalNullableText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().max(max).nullable().optional(),
  );

const optionalNullableIso = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date/time")
    .nullable()
    .optional(),
);

export const subEventCreateSchema = z.object({
  title: z.string().trim().min(1, "Sub-event title is required").max(160),
  description: optionalNullableText(1000),
  starts_at: optionalNullableIso,
  ends_at: optionalNullableIso,
  location_name: optionalNullableText(200),
  location_address: optionalNullableText(500),
  visibility: z.enum(["all", "invited_only"]).default("all"),
  sort_order: z.number().int().min(0).max(100).default(0),
  invited_guest_ids: z.array(z.string().uuid()).max(500).optional(),
});

export const subEventUpdateSchema = subEventCreateSchema.partial();

export const subEventRsvpBatchSchema = z.object({
  responses: z
    .array(
      z.object({
        sub_event_id: z.string().uuid(),
        status: z.enum(["attending", "not_attending", "maybe"]),
        headcount: z.number().int().min(1).max(50).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export type SubEventCreateInput = z.infer<typeof subEventCreateSchema>;
export type SubEventUpdateInput = z.infer<typeof subEventUpdateSchema>;
export type SubEventRsvpItem = z.infer<typeof subEventRsvpBatchSchema>["responses"][number];

function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Host view: all sub-events for an event with live RSVP headcounts and invited guest IDs. */
export async function listHostSubEvents(db: Pick<SubEventDb, "query">, eventId: string): Promise<HostSubEvent[]> {
  const [rows, invites] = await Promise.all([
    db.query<EventSubEvent & {
      attending_headcount: number;
      attending_count: number;
      maybe_count: number;
      not_attending_count: number;
    }>(
      `SELECT s.*,
        COALESCE((SELECT SUM(headcount) FROM sub_event_rsvps WHERE sub_event_id = s.id AND status = 'attending'), 0) AS attending_headcount,
        (SELECT COUNT(*) FROM sub_event_rsvps WHERE sub_event_id = s.id AND status = 'attending') AS attending_count,
        (SELECT COUNT(*) FROM sub_event_rsvps WHERE sub_event_id = s.id AND status = 'maybe') AS maybe_count,
        (SELECT COUNT(*) FROM sub_event_rsvps WHERE sub_event_id = s.id AND status = 'not_attending') AS not_attending_count
       FROM event_sub_events s
       WHERE s.event_id = $1
       ORDER BY s.sort_order ASC, s.created_at ASC`,
      [eventId],
    ),
    db.query<{ sub_event_id: string; guest_id: string }>(
      `SELECT sg.sub_event_id, sg.guest_id
       FROM sub_event_guests sg
       JOIN event_sub_events s ON s.id = sg.sub_event_id
       WHERE s.event_id = $1`,
      [eventId],
    ),
  ]);

  const bySubEvent = new Map<string, string[]>();
  for (const row of invites) {
    const list = bySubEvent.get(row.sub_event_id) ?? [];
    list.push(row.guest_id);
    bySubEvent.set(row.sub_event_id, list);
  }

  return rows.map((row) => ({
    ...row,
    starts_at: serializeTimestamp(row.starts_at),
    ends_at: serializeTimestamp(row.ends_at),
    created_at: serializeTimestamp(row.created_at) ?? "",
    updated_at: serializeTimestamp(row.updated_at) ?? "",
    attending_headcount: Number(row.attending_headcount ?? 0),
    attending_count: Number(row.attending_count ?? 0),
    maybe_count: Number(row.maybe_count ?? 0),
    not_attending_count: Number(row.not_attending_count ?? 0),
    invited_guest_ids: bySubEvent.get(row.id) ?? [],
  }));
}

export async function createSubEvent(db: SubEventDb, eventId: string, input: SubEventCreateInput): Promise<HostSubEvent> {
  const id = randomUUID();
  const statements: Statement[] = [
    {
      text: `INSERT INTO event_sub_events (id, event_id, title, description, starts_at, ends_at, location_name, location_address, visibility, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      params: [
        id,
        eventId,
        input.title,
        input.description ?? null,
        input.starts_at ? new Date(input.starts_at).toISOString() : null,
        input.ends_at ? new Date(input.ends_at).toISOString() : null,
        input.location_name ?? null,
        input.location_address ?? null,
        input.visibility,
        input.sort_order,
      ],
    },
  ];
  if (input.invited_guest_ids && input.invited_guest_ids.length > 0) {
    statements.push({
      text: `INSERT OR IGNORE INTO sub_event_guests (sub_event_id, guest_id)
             SELECT $1, id FROM guests WHERE event_id = $2 AND id IN (SELECT value FROM json_each($3))`,
      params: [id, eventId, input.invited_guest_ids],
    });
  }
  await db.batch(statements);
  const all = await listHostSubEvents(db, eventId);
  const created = all.find((item) => item.id === id);
  if (!created) throw new SubEventError("Failed to create sub-event.", 500);
  return created;
}

export async function updateSubEvent(
  db: SubEventDb,
  eventId: string,
  subEventId: string,
  input: SubEventUpdateInput,
): Promise<HostSubEvent | null> {
  const existing = (await db.query<EventSubEvent>(
    "SELECT * FROM event_sub_events WHERE id = $1 AND event_id = $2",
    [subEventId, eventId],
  ))[0];
  if (!existing) return null;

  const statements: Statement[] = [
    {
      text: `UPDATE event_sub_events
             SET title = $3, description = $4, starts_at = $5, ends_at = $6,
                 location_name = $7, location_address = $8, visibility = $9,
                 sort_order = $10, updated_at = ${SQL_NOW}
             WHERE id = $1 AND event_id = $2`,
      params: [
        subEventId,
        eventId,
        input.title ?? existing.title,
        input.description !== undefined ? input.description : existing.description,
        input.starts_at !== undefined
          ? (input.starts_at ? new Date(input.starts_at).toISOString() : null)
          : serializeTimestamp(existing.starts_at),
        input.ends_at !== undefined
          ? (input.ends_at ? new Date(input.ends_at).toISOString() : null)
          : serializeTimestamp(existing.ends_at),
        input.location_name !== undefined ? input.location_name : existing.location_name,
        input.location_address !== undefined ? input.location_address : existing.location_address,
        input.visibility ?? existing.visibility,
        input.sort_order ?? existing.sort_order,
      ],
    },
  ];

  if (input.invited_guest_ids !== undefined) {
    statements.push({
      text: "DELETE FROM sub_event_guests WHERE sub_event_id = $1",
      params: [subEventId],
    });
    if (input.invited_guest_ids.length > 0) {
      statements.push({
        text: `INSERT OR IGNORE INTO sub_event_guests (sub_event_id, guest_id)
               SELECT $1, id FROM guests WHERE event_id = $2 AND id IN (SELECT value FROM json_each($3))`,
        params: [subEventId, eventId, input.invited_guest_ids],
      });
    }
  }

  await db.batch(statements);
  const all = await listHostSubEvents(db, eventId);
  return all.find((item) => item.id === subEventId) ?? null;
}

export async function deleteSubEvent(
  db: Pick<SubEventDb, "query">,
  eventId: string,
  subEventId: string,
): Promise<boolean> {
  const deleted = await db.query<{ id: string }>(
    "DELETE FROM event_sub_events WHERE id = $1 AND event_id = $2 RETURNING id",
    [subEventId, eventId],
  );
  return deleted.length > 0;
}

/**
 * Guest/public view: returns ONLY sub-events with visibility='all' plus
 * 'invited_only' sub-events explicitly assigned to `guestId`.
 */
export async function listVisibleSubEvents(
  db: Pick<SubEventDb, "query">,
  eventId: string,
  guestId: string | null,
  rsvpResponseId: string | null,
): Promise<VisibleSubEvent[]> {
  const rows = await db.query<VisibleSubEvent>(
    `SELECT s.id, s.title, s.description, s.starts_at, s.ends_at,
            s.location_name, s.location_address, s.visibility, s.sort_order,
            r.status AS my_status, r.headcount AS my_headcount
     FROM event_sub_events s
     LEFT JOIN sub_event_rsvps r
       ON r.sub_event_id = s.id AND r.rsvp_response_id = $3
     WHERE s.event_id = $1
       AND (
         s.visibility = 'all'
         OR ($2 IS NOT NULL AND EXISTS (
           SELECT 1 FROM sub_event_guests sg
           WHERE sg.sub_event_id = s.id AND sg.guest_id = $2
         ))
       )
     ORDER BY s.sort_order ASC, s.created_at ASC`,
    [eventId, guestId, rsvpResponseId],
  );

  return rows.map((row) => ({
    ...row,
    starts_at: serializeTimestamp(row.starts_at),
    ends_at: serializeTimestamp(row.ends_at),
    my_status: row.my_status ?? null,
    my_headcount: row.my_headcount !== null && row.my_headcount !== undefined ? Number(row.my_headcount) : null,
  }));
}

/**
 * Atomically saves sub-event RSVPs for a respondent, guarding both event ownership
 * and per-guest visibility inside a single D1 batch.
 */
export async function saveSubEventRsvps(
  db: SubEventDb,
  eventId: string,
  rsvpResponseId: string,
  guestId: string | null,
  defaultHeadcount: number,
  items: SubEventRsvpItem[],
): Promise<VisibleSubEvent[]> {
  const statements: Statement[] = [
    guard(
      "EXISTS (SELECT 1 FROM rsvp_responses WHERE id = $1 AND event_id = $2)",
      [rsvpResponseId, eventId],
      "rsvp_missing",
    ),
  ];

  for (const item of items) {
    const headcount = item.status === "not_attending" ? 1 : Math.max(1, Math.min(50, item.headcount ?? defaultHeadcount));
    statements.push(
      guard(
        `EXISTS (
           SELECT 1 FROM event_sub_events s
           WHERE s.id = $1 AND s.event_id = $2
             AND (
               s.visibility = 'all'
               OR ($3 IS NOT NULL AND EXISTS (
                 SELECT 1 FROM sub_event_guests sg WHERE sg.sub_event_id = s.id AND sg.guest_id = $3
               ))
             )
         )`,
        [item.sub_event_id, eventId, guestId],
        "sub_event_forbidden",
      ),
      {
        text: `INSERT INTO sub_event_rsvps (sub_event_id, rsvp_response_id, guest_id, status, headcount, updated_at)
               VALUES ($1, $2, $3, $4, $5, ${SQL_NOW})
               ON CONFLICT (sub_event_id, rsvp_response_id) DO UPDATE SET
                 status = excluded.status,
                 headcount = excluded.headcount,
                 guest_id = COALESCE(excluded.guest_id, sub_event_rsvps.guest_id),
                 updated_at = ${SQL_NOW}`,
        params: [item.sub_event_id, rsvpResponseId, guestId, item.status, headcount],
      },
    );
  }

  try {
    await db.batch(statements);
  } catch (error) {
    const code = abortCode(error);
    if (code === "sub_event_forbidden") {
      throw new SubEventError("You do not have access to one of the selected sub-events.", 403);
    }
    if (code === "rsvp_missing") {
      throw new SubEventError("Please submit your main RSVP first.", 400);
    }
    throw error;
  }

  return listVisibleSubEvents(db, eventId, guestId, rsvpResponseId);
}

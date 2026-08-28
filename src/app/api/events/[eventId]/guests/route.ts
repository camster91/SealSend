import { NextResponse } from "next/server";
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { query, queryOne } from "@/lib/db/client";
import { guestSchema } from "@/lib/validations";
import { getEffectiveEventLimits, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import type { CountryCode } from "libphonenumber-js";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 500;

function parsePagination(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
  return { limit, offset };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const auth = await requireEventPermission(
      eventId,
      format === "check-in-csv" ? "export_responses" : "view_guest_contacts",
    );
    if (auth.error) return auth.error;

    if (format === "check-in-csv") {
      const guests = await query<{
        name: string;
        rsvp_status: string;
        invite_status: string;
        checked_in_at: string | null;
      }>(
        `SELECT name, rsvp_status, invite_status, checked_in_at
         FROM guests
         WHERE event_id = $1
         ORDER BY name ASC
         LIMIT 10000`,
        [eventId],
      );
      const escapeCell = (value: string) => {
        let safe = value.replace(/"/g, '""');
        if (/^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`;
        return `"${safe}"`;
      };
      const rows = guests.map((guest) => [
        guest.name,
        guest.rsvp_status,
        guest.invite_status,
        guest.checked_in_at ? "Checked in" : "Not checked in",
      ].map(escapeCell).join(","));
      const csv = [
        "Name,RSVP Status,Invitation Status,Check-in Status",
        ...rows,
      ].join("\n");

      await query(
        `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
         VALUES ($1, $2, 'guest_check_in_fallback_exported', $3::jsonb)`,
        [eventId, auth.user.id, JSON.stringify({ count: guests.length, format: "check-in-csv" })],
      );

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="check-in-fallback-${eventId}.csv"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const { limit, offset } = parsePagination(request);

    // Exclude sensitive token/error fields from list payloads
    const guests = await query(
      `SELECT id, event_id, name, email, phone, notes, invite_status, invite_sent_at,
              reminder_sent_at, tags, created_at, updated_at
       FROM guests
       WHERE event_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [eventId, limit, offset]
    );

    const countRow = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM guests WHERE event_id = $1',
      [eventId]
    );

    // Keep array response for existing clients; expose pagination via headers
    return NextResponse.json(guests, {
      headers: {
        'X-Total-Count': countRow?.count || '0',
        'X-Limit': String(limit),
        'X-Offset': String(offset),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const auth = await requireEventPermission(eventId, 'manage_guests');
    if (auth.error) return auth.error;

    // Verify ownership
    const event = await queryOne<{ id: string; user_id: string; tier: string }>(
      'SELECT id, user_id, tier FROM events WHERE id = $1',
      [eventId]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [accountPlan, countRow] = await Promise.all([
      getUserTier(event.user_id),
      queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM guests WHERE event_id = $1', [eventId]),
    ]);
    const guestLimit = getEffectiveEventLimits(accountPlan, event.tier as EventTier).guests;
    if (Number(countRow?.count ?? 0) >= guestLimit) {
      return NextResponse.json({ error: `This event is limited to ${guestLimit} guests.` }, { status: 403 });
    }

    const parsed = guestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
    }

    let phone = parsed.data.phone || null;
    if (phone) {
      const validation = validateAndFormatPhone(phone, (process.env.DEFAULT_COUNTRY || "US") as CountryCode);
      if (!validation.valid || !validation.formatted) {
        return NextResponse.json({ error: validation.error || "Invalid phone number" }, { status: 400 });
      }
      phone = validation.formatted;
    }

    const guest = await queryOne(
      'INSERT INTO guests (event_id, name, email, phone, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id, event_id, name, email, phone, notes, invite_status, created_at',
      [eventId, parsed.data.name, parsed.data.email || null, phone, parsed.data.notes || null]
    );

    await recordActivationEventSafely({
      name: "first_guest_added",
      userId: event.user_id,
      eventId,
      metadata: { source: "manual" },
    });

    return NextResponse.json(guest, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireApiHost } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import { guestSchema } from "@/lib/validations";
import { getEffectiveEventLimits, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";

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
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Verify ownership
    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Verify ownership
    const event = await queryOne<{ id: string; tier: string }>(
      'SELECT id, tier FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [accountPlan, countRow] = await Promise.all([
      getUserTier(user.id),
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

    const guest = await queryOne(
      'INSERT INTO guests (event_id, name, email, phone, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id, event_id, name, email, phone, notes, invite_status, created_at',
      [eventId, parsed.data.name, parsed.data.email || null, parsed.data.phone || null, parsed.data.notes || null]
    );

    return NextResponse.json(guest, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

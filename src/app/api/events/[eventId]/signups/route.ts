import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import { z } from "zod";

type RouteParams = { params: Promise<{ eventId: string }> };

const signupItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  slots: z.number().int().min(1).max(100).default(1),
});

// GET — list all signup items with claims (host only)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const items = await query(
      'SELECT * FROM event_signup_items WHERE event_id = $1 ORDER BY sort_order ASC',
      [eventId]
    );

    // Fetch claims for all items
    const itemIds = items.map((i: any) => i.id);
    let claims: any[] = [];
    if (itemIds.length > 0) {
      claims = await query(
        'SELECT * FROM event_signup_claims WHERE item_id = ANY($1)',
        [itemIds]
      );
    }

    // Attach claims to items
    const itemsWithClaims = items.map((item: any) => ({
      ...item,
      claims: claims.filter((c: any) => c.item_id === item.id),
    }));

    return NextResponse.json(itemsWithClaims);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — create a signup item (host only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = await queryOne<{ id: string; tier: string }>(
      'SELECT id, tier FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Tier gate: sign-up board requires premium (unlocked in beta)
    const { BETA_MODE } = await import("@/lib/constants");
    if (!BETA_MODE && event.tier !== "premium") {
      return NextResponse.json(
        { error: "Sign-up board requires a Premium upgrade" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = signupItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Get next sort_order
    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM event_signup_items WHERE event_id = $1',
      [eventId]
    );
    const sortOrder = countResult ? parseInt(countResult.count, 10) : 0;

    const item = await queryOne(
      `INSERT INTO event_signup_items (event_id, title, description, category, slots, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [eventId, parsed.data.title, parsed.data.description || null, parsed.data.category || null, parsed.data.slots, sortOrder]
    );

    if (!item) return NextResponse.json({ error: "Failed to create item" }, { status: 500 });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — delete a signup item (host only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const { itemId } = await request.json();
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await query(
      'DELETE FROM event_signup_items WHERE id = $1 AND event_id = $2',
      [itemId, eventId]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

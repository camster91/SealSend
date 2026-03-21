import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ slug: string }> };

const claimSchema = z.object({
  item_id: z.string().uuid(),
  claimant_name: z.string().min(1).max(200),
  claimant_email: z.string().email().optional().or(z.literal("")),
});

// GET — list signup items with claims for a public event
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const event = await queryOne<{ id: string }>(
      'SELECT id FROM events WHERE slug = $1 AND status = $2',
      [slug, "published"]
    );

    if (!event) return NextResponse.json([], { status: 200 });

    const items = await query(
      'SELECT * FROM event_signup_items WHERE event_id = $1 ORDER BY sort_order ASC',
      [event.id]
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
    return NextResponse.json([], { status: 200 });
  }
}

// POST — claim a signup item
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ip = getClientIp(request);
    const { success } = await rateLimit(`signup:${ip}`, { max: 20, windowSeconds: 600 });
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { slug } = await params;
    const body = await request.json();

    const event = await queryOne<{ id: string }>(
      'SELECT id FROM events WHERE slug = $1 AND status = $2',
      [slug, "published"]
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Verify item exists and belongs to this event
    const item = await queryOne<{ id: string; slots: number }>(
      'SELECT id, slots FROM event_signup_items WHERE id = $1 AND event_id = $2',
      [parsed.data.item_id, event.id]
    );

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if slots are available
    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM event_signup_claims WHERE item_id = $1',
      [item.id]
    );
    const count = countResult ? parseInt(countResult.count, 10) : 0;

    if (count >= item.slots) {
      return NextResponse.json({ error: "All slots are taken" }, { status: 403 });
    }

    const claim = await queryOne(
      `INSERT INTO event_signup_claims (item_id, event_id, claimant_name, claimant_email)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [parsed.data.item_id, event.id, parsed.data.claimant_name, parsed.data.claimant_email || null]
    );

    if (!claim) {
      return NextResponse.json({ error: "Failed to create claim" }, { status: 500 });
    }

    return NextResponse.json(claim, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

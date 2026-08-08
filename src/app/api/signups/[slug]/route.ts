import { NextResponse } from "next/server";
import { getDb, query, queryOne } from "@/lib/db/client";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { SignupClaim, SignupItem, SignupItemWithClaims } from "@/types/database";

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

    const items = await query<SignupItem>(
      'SELECT * FROM event_signup_items WHERE event_id = $1 ORDER BY sort_order ASC',
      [event.id]
    );

    // Fetch claims for all items
    const itemIds = items.map((item) => item.id);
    let claims: SignupClaim[] = [];
    if (itemIds.length > 0) {
      claims = await query<SignupClaim>(
        'SELECT * FROM event_signup_claims WHERE item_id = ANY($1)',
        [itemIds]
      );
    }

    // Attach claims to items — redact emails from public API
    const itemsWithClaims: SignupItemWithClaims[] = items.map((item) => ({
      ...item,
      claims: claims
        .filter((claim) => claim.item_id === item.id)
        .map((claim) => ({
          id: claim.id,
          item_id: claim.item_id,
          claimant_name: claim.claimant_name,
          claimant_email: null,
          event_id: claim.event_id,
          created_at: claim.created_at,
        })),
    }));

    return NextResponse.json(itemsWithClaims);
  } catch {
    return NextResponse.json({ error: "Unable to load sign-up items" }, { status: 500 });
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

    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      const itemResult = await client.query<{ id: string; slots: number }>(
        'SELECT id, slots FROM event_signup_items WHERE id = $1 AND event_id = $2 FOR UPDATE',
        [parsed.data.item_id, event.id]
      );
      const item = itemResult.rows[0];

      if (!item) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

    // Check if slots are available
      const countResult = await client.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM event_signup_claims WHERE item_id = $1',
      [item.id]
    );
      const count = parseInt(countResult.rows[0]?.count || '0', 10);

      if (count >= item.slots) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: "All slots are taken" }, { status: 403 });
      }

      const claimResult = await client.query(
      `INSERT INTO event_signup_claims (item_id, event_id, claimant_name, claimant_email)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [parsed.data.item_id, event.id, parsed.data.claimant_name, parsed.data.claimant_email || null]
    );
      const claim = claimResult.rows[0];

      if (!claim) throw new Error('Claim insert returned no row');
      await client.query('COMMIT');

      return NextResponse.json(claim, { status: 201 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

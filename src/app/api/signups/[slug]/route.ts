import { NextResponse } from "next/server";
import { batch, query, queryOne } from "@/lib/db/client";
import { abortCode, guard } from "@/lib/db/sqlite-dialect";
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
        'SELECT * FROM event_signup_claims WHERE item_id IN (SELECT value FROM json_each($1))',
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

    const item = await queryOne<{ id: string; slots: number }>(
      'SELECT id, slots FROM event_signup_items WHERE id = $1 AND event_id = $2',
      [parsed.data.item_id, event.id]
    );

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if slots are available
    const countRow = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM event_signup_claims WHERE item_id = $1',
      [item.id]
    );
    if (Number(countRow?.count ?? 0) >= item.slots) {
      return NextResponse.json({ error: "All slots are taken" }, { status: 403 });
    }

    // The guards re-check the item and its free slots when the insert runs (batches run one at a time).
    let claim: unknown;
    try {
      const results = await batch([
        guard('EXISTS (SELECT 1 FROM event_signup_items WHERE id = $1 AND event_id = $2)', [item.id, event.id], 'item_missing'),
        guard(
          '(SELECT COUNT(*) FROM event_signup_claims WHERE item_id = $1) < (SELECT slots FROM event_signup_items WHERE id = $1)',
          [item.id], 'slots_taken'
        ),
        {
          text: `INSERT INTO event_signup_claims (item_id, event_id, claimant_name, claimant_email)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
          params: [parsed.data.item_id, event.id, parsed.data.claimant_name, parsed.data.claimant_email || null],
        },
      ]);
      claim = results[2][0];
    } catch (error) {
      const code = abortCode(error);
      if (code === 'item_missing') return NextResponse.json({ error: "Item not found" }, { status: 404 });
      if (code === 'slots_taken') return NextResponse.json({ error: "All slots are taken" }, { status: 403 });
      throw error;
    }

    if (!claim) throw new Error('Claim insert returned no row');

    return NextResponse.json(claim, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

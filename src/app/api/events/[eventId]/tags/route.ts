import { NextResponse } from "next/server";
import { requireApiHost } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import { z } from "zod";

const tagSchema = z.object({
  tag_name: z.string().min(1).max(50).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default("#7c3aed"),
});

const deleteTagSchema = z.object({
  tagId: z.string().uuid(),
});

export async function GET(
  _request: Request,
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

    const tags = await query(
      'SELECT * FROM guest_tags WHERE event_id = $1 ORDER BY created_at ASC',
      [eventId]
    );

    return NextResponse.json(tags);
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

    // Tier gate: tags require standard or premium (unlocked in beta)
    const { BETA_MODE } = await import("@/lib/constants");
    if (!BETA_MODE && event.tier === "free") {
      return NextResponse.json(
        { error: "Guest tags require a Standard or Premium upgrade" },
        { status: 403 }
      );
    }

    const parsed = tagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
    }

    const tag = await queryOne(
      'INSERT INTO guest_tags (event_id, tag_name, color) VALUES ($1, $2, $3) RETURNING *',
      [eventId, parsed.data.tag_name, parsed.data.color]
    );

    return NextResponse.json(tag, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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
    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = deleteTagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }

    await query(
      'DELETE FROM guest_tags WHERE id = $1 AND event_id = $2',
      [parsed.data.tagId, eventId]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

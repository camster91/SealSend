import { NextResponse } from "next/server";
import { requireApiHost } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(
  _request: Request,
  { params }: RouteParams
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

    const comments = await query(
      'SELECT * FROM event_comments WHERE event_id = $1 ORDER BY created_at DESC',
      [eventId]
    );

    return NextResponse.json(comments);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const { commentId } = await request.json();
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Verify ownership
    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await query(
      'DELETE FROM event_comments WHERE id = $1 AND event_id = $2',
      [commentId, eventId]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

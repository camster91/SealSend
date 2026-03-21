import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import { guestSchema } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify ownership
    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const guests = await query(
      'SELECT * FROM guests WHERE event_id = $1 ORDER BY created_at DESC',
      [eventId]
    );

    return NextResponse.json(guests);
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
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify ownership
    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = guestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
    }

    const guest = await queryOne(
      'INSERT INTO guests (event_id, name, email, phone, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [eventId, parsed.data.name, parsed.data.email || null, parsed.data.phone || null, parsed.data.notes || null]
    );

    return NextResponse.json(guest, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

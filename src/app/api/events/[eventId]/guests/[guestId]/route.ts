import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import { guestSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; guestId: string }> }
) {
  try {
    const { eventId, guestId } = await params;
    const body = await request.json();
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = guestSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Build dynamic SET clause from parsed fields (whitelist columns)
    const ALLOWED_COLUMNS = ['name', 'email', 'phone', 'notes'];
    const fields = Object.entries(parsed.data).filter(([k, v]) => v !== undefined && ALLOWED_COLUMNS.includes(k));
    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const setClauses = fields.map(([key], i) => `${key} = $${i + 1}`);
    const values = fields.map(([, v]) => v);
    const paramOffset = fields.length;

    const guest = await queryOne(
      `UPDATE guests SET ${setClauses.join(', ')} WHERE id = $${paramOffset + 1} AND event_id = $${paramOffset + 2} RETURNING *`,
      [...values, guestId, eventId]
    );

    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

    return NextResponse.json(guest);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; guestId: string }> }
) {
  try {
    const { eventId, guestId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await query(
      'DELETE FROM guests WHERE id = $1 AND event_id = $2',
      [guestId, eventId]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { query, queryOne } from "@/lib/db/client";
import { guestSchema } from "@/lib/validations";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import type { CountryCode } from "libphonenumber-js";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; guestId: string }> }
) {
  try {
    const { eventId, guestId } = await params;
    const body = await request.json();
    const auth = await requireEventPermission(eventId, 'manage_guests');
    if (auth.error) return auth.error;

    const parsed = guestSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    if (parsed.data.phone) {
      const validation = validateAndFormatPhone(parsed.data.phone, (process.env.DEFAULT_COUNTRY || "US") as CountryCode);
      if (!validation.valid || !validation.formatted) {
        return NextResponse.json({ error: validation.error || "Invalid phone number" }, { status: 400 });
      }
      parsed.data.phone = validation.formatted;
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
    const auth = await requireEventPermission(eventId, 'manage_guests');
    if (auth.error) return auth.error;

    await query(
      'DELETE FROM guests WHERE id = $1 AND event_id = $2',
      [guestId, eventId]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { getApiUser } from "@/lib/auth/api-auth";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get original event
    const originalEvent = await queryOne<Record<string, unknown>>(
      'SELECT * FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!originalEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get RSVP fields
    const rsvpFields = await query<Record<string, unknown>>(
      'SELECT * FROM rsvp_fields WHERE event_id = $1',
      [eventId]
    );

    // Get guests
    const guests = await query<{ name: string; email: string; phone: string; notes: string }>(
      'SELECT name, email, phone, notes FROM guests WHERE event_id = $1',
      [eventId]
    );

    // Create new event (clone) - exclude id, title, status, created_at, updated_at
    const { title, status: _status, created_at: _created_at, updated_at: _updated_at, id: _id, ...eventData } = originalEvent;

    const columns = Object.keys(eventData);
    const paramIndices = columns.map((_, i) => `$${i + 1}`);
    // Add title, status, user_id
    columns.push('title', 'status', 'user_id');
    paramIndices.push(`$${columns.length - 2}`, `$${columns.length - 1}`, `$${columns.length}`);

    const values = [
      ...Object.values(eventData),
      `${title} (Copy)`,
      'draft',
      user.id,
    ];

    const newEvent = await queryOne<Record<string, unknown>>(
      `INSERT INTO events (${columns.join(', ')}) VALUES (${paramIndices.join(', ')}) RETURNING *`,
      values
    );

    if (!newEvent) {
      console.error("Clone error: insert returned no rows");
      return NextResponse.json({ error: "Failed to clone event" }, { status: 500 });
    }

    // Clone RSVP fields
    if (rsvpFields.length > 0) {
      const placeholders: string[] = [];
      const fieldValues: unknown[] = [];
      let paramIdx = 1;

      for (const field of rsvpFields) {
        const { id: _id, event_id: _eventId, created_at: _createdAt, ...fieldData } = field;
        const fieldKeys = Object.keys(fieldData);

        if (paramIdx === 1) {
          // Build column list from first row
          const colList = ['event_id', ...fieldKeys];
          const ph = colList.map((_, i) => `$${paramIdx + i}`);
          placeholders.push(`(${ph.join(', ')})`);
          fieldValues.push(newEvent.id, ...Object.values(fieldData));
          paramIdx += colList.length;
        } else {
          const colCount = fieldKeys.length + 1;
          const ph = Array.from({ length: colCount }, (_, i) => `$${paramIdx + i}`);
          placeholders.push(`(${ph.join(', ')})`);
          fieldValues.push(newEvent.id, ...Object.values(fieldData));
          paramIdx += colCount;
        }
      }

      // Get column names from first field
      const { id: _id, event_id: _eventId, created_at: _createdAt, ...firstFieldData } = rsvpFields[0];
      const colNames = ['event_id', ...Object.keys(firstFieldData)];

      await query(
        `INSERT INTO rsvp_fields (${colNames.join(', ')}) VALUES ${placeholders.join(', ')}`,
        fieldValues
      );
    }

    // Clone guests (optional - could be disabled)
    if (guests.length > 0) {
      const placeholders: string[] = [];
      const guestValues: unknown[] = [];
      let paramIdx = 1;

      for (const guest of guests) {
        placeholders.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`);
        guestValues.push(
          newEvent.id,
          guest.name,
          guest.email,
          guest.phone,
          guest.notes,
          'not_sent',
          null,
        );
        paramIdx += 7;
      }

      await query(
        `INSERT INTO guests (event_id, name, email, phone, notes, invite_status, reminder_sent_at) VALUES ${placeholders.join(', ')}`,
        guestValues
      );
    }

    return NextResponse.json({
      success: true,
      event: newEvent,
      message: `Event cloned successfully with ${guests.length || 0} guests`
    });
  } catch (error) {
    console.error("Clone error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

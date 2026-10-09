import { NextResponse } from "next/server";
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { getDb } from "@/lib/db/client";
import { deleteRsvp, type RsvpQuery } from '@/lib/rsvp-store';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; responseId: string }> }
) {
  try {
    const { eventId, responseId } = await params;
    const auth = await requireEventPermission(eventId, 'edit_event');
    if (auth.error) return auth.error;

    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      const db: RsvpQuery = async <T>(sql: string, values?: unknown[]) => ({
        rows: (await client.query(sql, values)).rows as T[],
      });
      await deleteRsvp(db, eventId, responseId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { query, queryOne } from '@/lib/db/client';
import type { Event } from '@/types/database';

export async function getEvent(eventId: string) {
  const data = await queryOne<Event>(
    'SELECT * FROM events WHERE id = $1',
    [eventId]
  );

  if (!data) {
    console.error('Error fetching event: not found');
    return null;
  }

  return data;
}

export async function getEventsByUser(userId: string) {
  const data = await query<Event>(
    'SELECT * FROM events WHERE user_id = $1 ORDER BY event_date ASC',
    [userId]
  );

  return data || [];
}

export async function getInvitedEvents(email: string | null, phone: string | null) {
  if (!email && !phone) {
    return [];
  }

  // Optimized: Using a single JOIN query with DISTINCT reduces database round-trips
  // and improves performance for users invited to multiple events.
  const events = await query<Event>(
    `SELECT DISTINCT e.*
     FROM events e
     JOIN guests g ON e.id = g.event_id
     WHERE (g.email = $1 AND $1 IS NOT NULL)
        OR (g.phone = $2 AND $2 IS NOT NULL)
     ORDER BY e.event_date ASC`,
    [email, phone]
  );

  return events || [];
}

export async function getEventGuests(eventId: string) {
  const data = await query(
    'SELECT * FROM guests WHERE event_id = $1 ORDER BY created_at DESC',
    [eventId]
  );

  return data || [];
}

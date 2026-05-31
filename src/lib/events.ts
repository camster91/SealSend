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

export async function getInvitedEvents(identifier: string) {
  // Optimization: Use a single JOIN query with DISTINCT to fetch invited events in one database round-trip
  const events = await query<Event>(
    `SELECT DISTINCT e.* FROM events e
     JOIN guests g ON e.id = g.event_id
     WHERE g.email = $1 OR g.phone = $1
     ORDER BY e.event_date ASC`,
    [identifier]
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

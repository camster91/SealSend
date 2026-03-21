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

export async function getInvitedEvents(userId: string) {
  // Get events where this user has a guest entry
  const guestEntries = await query<{ event_id: string }>(
    'SELECT event_id FROM guests WHERE email = $1 OR phone = $1',
    [userId]
  );

  if (!guestEntries || guestEntries.length === 0) {
    return [];
  }

  // Get the actual events
  const eventIds = guestEntries.map(g => g.event_id);
  const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(', ');
  const events = await query<Event>(
    `SELECT * FROM events WHERE id IN (${placeholders}) ORDER BY event_date ASC`,
    eventIds
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

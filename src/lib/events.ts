import { query, queryOne } from '@/lib/db/client';
import type { Event } from '@/types/database';

export async function getEvent(eventId: string, options?: { publishedOnly?: boolean }) {
  const data = options?.publishedOnly
    ? await queryOne<Event>(
        `SELECT * FROM events WHERE id = $1 AND status = 'published'`,
        [eventId]
      )
    : await queryOne<Event>(
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
    'SELECT * FROM events WHERE user_id = $1 ORDER BY event_date ASC NULLS LAST LIMIT 500',
    [userId]
  );

  return data || [];
}

export async function getCollaboratingEvents(userId: string) {
  const data = await query<Event & { access_role: string }>(
    `SELECT * FROM (
       SELECT e.*, em.role AS access_role
         FROM event_members em
         JOIN events e ON e.id = em.event_id
        WHERE em.user_id = $1
       UNION ALL
       -- Events in team workspaces the host belongs to (see src/lib/auth/event-access.ts)
       SELECT e.*, CASE om.role WHEN 'planner' THEN 'manager' WHEN 'check_in' THEN 'check_in' ELSE 'owner' END AS access_role
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id AND NOT o.is_personal
         JOIN events e ON e.organization_id = om.organization_id
        WHERE om.user_id = $1 AND e.user_id <> $1
     ) shared
     ORDER BY event_date ASC NULLS LAST
     LIMIT 500`,
    [userId]
  );
  return data || [];
}

export async function getInvitedEvents(email: string | null, phone: string | null) {
  if (!email && !phone) {
    return [];
  }

  // Only return published events the guest was invited to (prevents draft IDOR via forged cookie email)
  const events = await query<Event>(
    `SELECT DISTINCT e.*
     FROM events e
     JOIN guests g ON e.id = g.event_id
     WHERE e.status = 'published'
       AND (
         (g.email IS NOT NULL AND LOWER(g.email) = LOWER($1) AND $1 IS NOT NULL)
         OR (g.phone IS NOT NULL AND g.phone = $2 AND $2 IS NOT NULL)
       )
     ORDER BY e.event_date ASC NULLS LAST
     LIMIT 200`,
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

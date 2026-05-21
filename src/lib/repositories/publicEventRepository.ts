import { prisma } from '@/lib/db';

export async function getPublicEventBySlug(slug: string) {
  try {
    const event = await prisma.event.findFirst({
      where: { slug, status: 'published' },
    });

    if (!event) {
      return { data: null, error: 'Event not found' };
    }

    return { data: event, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch event' };
  }
}

export async function getRsvpFields(eventId: string) {
  try {
    const fields = await prisma.rsvpField.findMany({
      where: { event_id: eventId },
      orderBy: { sort_order: 'asc' },
    });

    return { data: fields, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch RSVP fields' };
  }
}

export async function getRemainingSpots(eventId: string, maxAttendees: number | null) {
  if (!maxAttendees) return null;

  const attendingResponses = await prisma.rsvpResponse.findMany({
    where: { event_id: eventId, status: 'attending' },
    select: { headcount: true },
  });

  const currentTotal = attendingResponses.reduce(
    (sum: number, r: { headcount: number }) => sum + (r.headcount || 1),
    0
  );
  return Math.max(0, maxAttendees - currentTotal);
}

export async function getInviteGuest(eventId: string, token: string) {
  try {
    const guest = await prisma.guest.findFirst({
      where: { invite_token: token, event_id: eventId },
      select: { id: true, name: true, email: true },
    });

    if (!guest) {
      return { data: null, error: 'Guest not found' };
    }

    return { data: guest, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch guest' };
  }
}

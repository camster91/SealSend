import { prisma } from '@/lib/db';

export async function getEventById(eventId: string, userId: string) {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: userId },
    });

    if (!event) {
      return { data: null, error: 'Event not found' };
    }

    return { data: event, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch event' };
  }
}

export async function getEventMetrics(eventId: string) {
  const [responseCount, guestCount] = await Promise.all([
    prisma.rsvpResponse.count({
      where: { event_id: eventId },
    }),
    prisma.guest.count({
      where: { event_id: eventId },
    }),
  ]);

  return {
    responseCount,
    guestCount,
  };
}

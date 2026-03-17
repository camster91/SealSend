import { prisma } from '@/lib/db';

export async function getEvent(eventId: string) {
  try {
    return await prisma.event.findUnique({ where: { id: eventId } });
  } catch (error) {
    console.error('Error fetching event:', error);
    return null;
  }
}

export async function getEventsByUser(userId: string) {
  try {
    return await prisma.event.findMany({
      where: { user_id: userId },
      orderBy: { event_date: 'asc' },
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

export async function getInvitedEvents(userId: string) {
  try {
    const guestEntries = await prisma.guest.findMany({
      where: {
        OR: [{ email: userId }, { phone: userId }],
      },
      select: { event_id: true },
    });

    if (guestEntries.length === 0) return [];

    const eventIds = guestEntries.map((g) => g.event_id);
    return await prisma.event.findMany({
      where: { id: { in: eventIds } },
      orderBy: { event_date: 'asc' },
    });
  } catch (error) {
    console.error('Error fetching invited events:', error);
    return [];
  }
}

export async function getEventGuests(eventId: string) {
  try {
    return await prisma.guest.findMany({
      where: { event_id: eventId },
      orderBy: { created_at: 'desc' },
    });
  } catch (error) {
    console.error('Error fetching guests:', error);
    return [];
  }
}

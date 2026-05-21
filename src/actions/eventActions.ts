'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { UnauthorizedError, NotFoundError, AppError } from '@/lib/errors';

export async function toggleEventStatus(eventId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError('User not authenticated');
  }

  // 1. Fetch current event
  const event = await prisma.event.findFirst({
    where: { id: eventId, user_id: user.id },
    select: { id: true, status: true },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // 2. Toggle status
  const newStatus = event.status === 'published' ? 'draft' : 'published';

  try {
    await prisma.event.update({
      where: { id: eventId },
      data: { status: newStatus },
    });
  } catch {
    throw new AppError('Failed to update event status');
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, newStatus };
}

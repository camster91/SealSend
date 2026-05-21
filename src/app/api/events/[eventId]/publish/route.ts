import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/auth/api-auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch the current event to get its status
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true, status: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Toggle status between draft and published
    const newStatus = event.status === 'published' ? 'draft' : 'published';

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: { status: newStatus },
    });

    return NextResponse.json(updatedEvent);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

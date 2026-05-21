import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { prisma } from '@/lib/db';

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true },
    });

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const comments = await prisma.eventComment.findMany({
      where: { event_id: eventId },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(comments);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const { commentId } = await request.json();
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true },
    });

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.eventComment.deleteMany({
      where: { id: commentId, event_id: eventId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

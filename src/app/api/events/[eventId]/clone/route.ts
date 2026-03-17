import { NextResponse } from "next/server";
import { prisma } from '@/lib/db';
import { getApiUser } from "@/lib/auth/api-auth";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get original event
    const originalEvent = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
    });

    if (!originalEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get RSVP fields
    const rsvpFields = await prisma.rsvpField.findMany({
      where: { event_id: eventId },
    });

    // Get guests
    const guests = await prisma.guest.findMany({
      where: { event_id: eventId },
      select: { name: true, email: true, phone: true, notes: true },
    });

    // Create new event (clone)
    const { title, status, created_at, updated_at, id, ...eventData } = originalEvent;

    const newEvent = await prisma.event.create({
      data: {
        ...eventData,
        title: `${title} (Copy)`,
        status: "draft",
        user_id: user.id,
      },
    });

    // Clone RSVP fields
    if (rsvpFields && rsvpFields.length > 0) {
      const newFields = rsvpFields.map(({ id, event_id, created_at, ...field }) => ({
        ...field,
        event_id: newEvent.id,
      }));

      await prisma.rsvpField.createMany({ data: newFields });
    }

    // Clone guests (optional - could be disabled)
    if (guests && guests.length > 0) {
      const newGuests = guests.map(guest => ({
        ...guest,
        event_id: newEvent.id,
        invite_status: "not_sent",
        reminder_sent_at: null,
      }));

      await prisma.guest.createMany({ data: newGuests });
    }

    return NextResponse.json({
      success: true,
      event: newEvent,
      message: `Event cloned successfully with ${guests?.length || 0} guests`
    });
  } catch (error) {
    console.error("Clone error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/auth/api-auth';
import { prisma } from '@/lib/db';
import { rsvpFieldSchema } from '@/lib/validations';

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(
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

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const fields = await prisma.rsvpField.findMany({
      where: { event_id: eventId },
      orderBy: { sort_order: 'asc' },
    });

    return NextResponse.json(fields);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
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

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be an array of RSVP field objects' },
        { status: 400 }
      );
    }

    // Validate ALL fields BEFORE deleting existing ones (atomic approach)
    const fields = [];
    for (let index = 0; index < body.length; index++) {
      const parsed = rsvpFieldSchema.safeParse(body[index]);
      if (!parsed.success) {
        return NextResponse.json(
          { error: `Invalid field at index ${index}`, details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      fields.push({
        event_id: eventId,
        field_name: parsed.data.field_name,
        field_type: parsed.data.field_type,
        field_label: parsed.data.field_label,
        is_required: parsed.data.is_required,
        is_enabled: parsed.data.is_enabled,
        sort_order: index,
        options: parsed.data.options ?? null,
        placeholder: parsed.data.placeholder ?? null,
      });
    }

    // Delete existing RSVP fields for this event (only after validation passes)
    await prisma.rsvpField.deleteMany({
      where: { event_id: eventId },
    });

    // Insert validated fields
    if (fields.length > 0) {
      await prisma.rsvpField.createMany({ data: fields });
    }

    // Return the newly inserted fields
    const updatedFields = await prisma.rsvpField.findMany({
      where: { event_id: eventId },
      orderBy: { sort_order: 'asc' },
    });

    return NextResponse.json(updatedFields);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

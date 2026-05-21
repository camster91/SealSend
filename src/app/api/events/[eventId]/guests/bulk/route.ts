import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { prisma } from '@/lib/db';
import { guestBulkSchema } from "@/lib/validations";
import { validateAndFormatPhone } from "@/lib/phone-validation";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true },
    });

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = guestBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check for existing guests to avoid duplicates
    const existingGuests = await prisma.guest.findMany({
      where: { event_id: eventId },
      select: { email: true, phone: true },
    });

    const existingEmails = new Set((existingGuests || [])
      .map(g => g.email?.toLowerCase())
      .filter(Boolean));

    const existingPhones = new Set((existingGuests || [])
      .map(g => g.phone)
      .filter(Boolean));

    const duplicates: Array<{ name: string; reason: string }> = [];
    const validationErrors: Array<{ index: number; message: string }> = [];

    const guests = parsed.data
      .map((g, index) => {
        // Check for duplicates in existing guests
        if (g.email && existingEmails.has(g.email.toLowerCase())) {
          duplicates.push({ name: g.name, reason: `Email ${g.email} already exists` });
          return null;
        }

        if (g.phone) {
          const phoneValidation = validateAndFormatPhone(g.phone);
          if (phoneValidation.valid && phoneValidation.formatted && existingPhones.has(phoneValidation.formatted)) {
            duplicates.push({ name: g.name, reason: `Phone ${g.phone} already exists` });
            return null;
          }
        }

        // Validate phone number format
        let formattedPhone = g.phone || null;
        if (g.phone) {
          const phoneValidation = validateAndFormatPhone(g.phone);
          if (!phoneValidation.valid) {
            validationErrors.push({
              index,
              message: `Invalid phone number for ${g.name}: ${phoneValidation.error}`,
            });
            // Still accept the guest, but without the invalid phone
            formattedPhone = null;
          } else {
            formattedPhone = phoneValidation.formatted!;
          }
        }

        return {
          event_id: eventId,
          name: g.name.trim(),
          email: g.email?.toLowerCase().trim() || null,
          phone: formattedPhone,
          notes: g.notes?.trim() || null,
        };
      })
      .filter(Boolean) as Array<{
        event_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        notes: string | null;
      }>;

    if (guests.length === 0) {
      return NextResponse.json({
        inserted: 0,
        skipped: duplicates.length,
        imported: 0,
        errors: validationErrors,
        duplicates,
      }, { status: 200 });
    }

    try {
      await prisma.guest.createMany({ data: guests });

      // Fetch the inserted guests to return them
      const insertedGuests = await prisma.guest.findMany({
        where: {
          event_id: eventId,
          name: { in: guests.map(g => g.name) },
        },
        select: { id: true, name: true, email: true, phone: true },
        orderBy: { created_at: 'desc' },
        take: guests.length,
      });

      return NextResponse.json({
        imported: insertedGuests?.length || 0,
        skipped: duplicates.length,
        errors: validationErrors,
        duplicates: duplicates.length > 0 ? duplicates : undefined,
        guests: insertedGuests,
      }, { status: 201 });
    } catch (error: any) {
      console.error('Bulk insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

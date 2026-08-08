import { NextResponse } from "next/server";
import { requireApiHost } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import { guestBulkSchema } from "@/lib/validations";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { getEffectiveEventLimits, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Verify ownership
    const event = await queryOne<{ id: string; tier: string }>(
      'SELECT id, tier FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = guestBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check for existing guests to avoid duplicates
    const existingGuests = await query<{ email: string | null; phone: string | null }>(
      'SELECT email, phone FROM guests WHERE event_id = $1',
      [eventId]
    );

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

    const accountPlan = await getUserTier(user.id);
    const guestLimit = getEffectiveEventLimits(accountPlan, event.tier as EventTier).guests;
    if (existingGuests.length + guests.length > guestLimit) {
      return NextResponse.json(
        { error: `This import would exceed the event limit of ${guestLimit} guests.` },
        { status: 403 }
      );
    }

    // Build bulk INSERT with parameterized values
    const valuePlaceholders: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    for (const g of guests) {
      valuePlaceholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
      queryParams.push(g.event_id, g.name, g.email, g.phone, g.notes);
      paramIndex += 5;
    }

    const insertedGuests = await query<{ id: string; name: string; email: string | null; phone: string | null }>(
      `INSERT INTO guests (event_id, name, email, phone, notes) VALUES ${valuePlaceholders.join(', ')} RETURNING id, name, email, phone`,
      queryParams
    );

    return NextResponse.json({
      inserted: insertedGuests?.length || 0,
      skipped: duplicates.length,
      imported: insertedGuests?.length || 0,
      errors: validationErrors,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      guests: insertedGuests,
    }, { status: 201 });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

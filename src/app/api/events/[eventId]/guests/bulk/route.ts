import { NextResponse } from "next/server";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { query, queryOne } from "@/lib/db/client";
import { guestBulkSchema } from "@/lib/validations";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { getEffectiveEventLimits, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";
import { deduplicateGuestImport, type NormalizedGuestImport } from "@/lib/guest-import";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const auth = await requireEventPermission(eventId, 'manage_guests');
    if (auth.error) return auth.error;

    // Verify ownership
    const event = await queryOne<{ id: string; user_id: string; tier: string }>(
      'SELECT id, user_id, tier FROM events WHERE id = $1',
      [eventId]
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

    const validationErrors: Array<{ index: number; message: string }> = [];

    const normalizedGuests = parsed.data
      .map((g, index) => {
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
          name: g.name.trim(),
          email: g.email?.toLowerCase().trim() || null,
          phone: formattedPhone,
          notes: g.notes?.trim() || null,
        };
      }) satisfies NormalizedGuestImport[];
    const { accepted, duplicates } = deduplicateGuestImport(normalizedGuests, existingGuests);
    const guests = accepted.map((guest) => ({
      ...guest,
      event_id: eventId,
    })) as Array<{
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

    const accountPlan = await getUserTier(event.user_id);
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
    if (insertedGuests.length > 0) {
      await recordActivationEventSafely({
        name: "guest_import_completed",
        userId: event.user_id,
        eventId,
      });
    }

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

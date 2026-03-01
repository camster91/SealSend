import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";
import { guestBulkSchema } from "@/lib/validations";
import { validateAndFormatPhone } from "@/lib/phone-validation";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminSupabase = createAdminClient();

    // Verify ownership
    const { data: event } = await adminSupabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = guestBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check for existing guests to avoid duplicates
    const { data: existingGuests } = await adminSupabase
      .from("guests")
      .select("email, phone")
      .eq("event_id", eventId);

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
          if (phoneValidation.valid && existingPhones.has(phoneValidation.formatted)) {
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
        imported: 0,
        skipped: duplicates.length,
        errors: validationErrors,
        duplicates,
      }, { status: 200 });
    }

    const { error, data: insertedGuests } = await adminSupabase
      .from("guests")
      .insert(guests)
      .select('id, name, email, phone');

    if (error) {
      console.error('Bulk insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      imported: insertedGuests?.length || 0,
      skipped: duplicates.length,
      errors: validationErrors,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      guests: insertedGuests,
    }, { status: 201 });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

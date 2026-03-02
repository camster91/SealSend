import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/auth/api-auth";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminSupabase = createAdminClient();

    // Get original event
    const { data: originalEvent, error: eventError } = await adminSupabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (eventError || !originalEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get RSVP fields
    const { data: rsvpFields } = await adminSupabase
      .from("rsvp_fields")
      .select("*")
      .eq("event_id", eventId);

    // Get guests
    const { data: guests } = await adminSupabase
      .from("guests")
      .select("name, email, phone, notes")
      .eq("event_id", eventId);

    // Create new event (clone)
    const { title, status, created_at, updated_at, id, ...eventData } = originalEvent;
    
    const { data: newEvent, error: createError } = await adminSupabase
      .from("events")
      .insert({
        ...eventData,
        title: `${title} (Copy)`,
        status: "draft",
        user_id: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Clone error:", createError);
      return NextResponse.json({ error: "Failed to clone event" }, { status: 500 });
    }

    // Clone RSVP fields
    if (rsvpFields && rsvpFields.length > 0) {
      const newFields = rsvpFields.map(({ id, event_id, created_at, ...field }) => ({
        ...field,
        event_id: newEvent.id,
      }));
      
      await adminSupabase.from("rsvp_fields").insert(newFields);
    }

    // Clone guests (optional - could be disabled)
    if (guests && guests.length > 0) {
      const newGuests = guests.map(guest => ({
        ...guest,
        event_id: newEvent.id,
        invite_status: "not_sent",
        reminder_sent_at: null,
      }));
      
      await adminSupabase.from("guests").insert(newGuests);
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

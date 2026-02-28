import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";
import { guestSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; guestId: string }> }
) {
  try {
    const { eventId, guestId } = await params;
    const body = await request.json();
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminSupabase = createAdminClient();

    const { data: event } = await adminSupabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = guestSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const { data: guest, error } = await adminSupabase
      .from("guests")
      .update(parsed.data)
      .eq("id", guestId)
      .eq("event_id", eventId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(guest);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; guestId: string }> }
) {
  try {
    const { eventId, guestId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminSupabase = createAdminClient();

    const { data: event } = await adminSupabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await adminSupabase
      .from("guests")
      .delete()
      .eq("id", guestId)
      .eq("event_id", eventId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

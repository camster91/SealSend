import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; responseId: string }> }
) {
  try {
    const { eventId, responseId } = await params;
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
      .from("rsvp_responses")
      .delete()
      .eq("id", responseId)
      .eq("event_id", eventId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

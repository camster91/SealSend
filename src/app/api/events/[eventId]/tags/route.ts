import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const tagSchema = z.object({
  tag_name: z.string().min(1).max(50).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default("#7c3aed"),
});

const deleteTagSchema = z.object({
  tagId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
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

    const { data: tags, error } = await adminSupabase
      .from("guest_tags")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(tags);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminSupabase = createAdminClient();

    // Verify ownership
    const { data: event } = await adminSupabase
      .from("events")
      .select("id, tier")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Tier gate: tags require standard or premium (unlocked in beta)
    const { BETA_MODE } = await import("@/lib/constants");
    if (!BETA_MODE && event.tier === "free") {
      return NextResponse.json(
        { error: "Guest tags require a Standard or Premium upgrade" },
        { status: 403 }
      );
    }

    const parsed = tagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
    }

    const { data: tag, error } = await adminSupabase
      .from("guest_tags")
      .insert({
        event_id: eventId,
        tag_name: parsed.data.tag_name,
        color: parsed.data.color,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(tag, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
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

    const parsed = deleteTagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }

    const { error } = await adminSupabase
      .from("guest_tags")
      .delete()
      .eq("id", parsed.data.tagId)
      .eq("event_id", eventId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

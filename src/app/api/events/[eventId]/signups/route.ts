import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

type RouteParams = { params: Promise<{ eventId: string }> };

const signupItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  slots: z.number().int().min(1).max(100).default(1),
});

// GET — list all signup items with claims (host only)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: event } = await admin
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: items } = await admin
      .from("event_signup_items")
      .select("*, claims:event_signup_claims(*)")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    return NextResponse.json(items ?? []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — create a signup item (host only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: event } = await admin
      .from("events")
      .select("id, tier")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Tier gate: sign-up board requires premium (unlocked in beta)
    const { BETA_MODE } = await import("@/lib/constants");
    if (!BETA_MODE && event.tier !== "premium") {
      return NextResponse.json(
        { error: "Sign-up board requires a Premium upgrade" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = signupItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Get next sort_order
    const { count } = await admin
      .from("event_signup_items")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    const { data: item, error } = await admin
      .from("event_signup_items")
      .insert({
        event_id: eventId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        category: parsed.data.category || null,
        slots: parsed.data.slots,
        sort_order: count ?? 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — delete a signup item (host only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const { itemId } = await request.json();
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: event } = await admin
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await admin
      .from("event_signup_items")
      .delete()
      .eq("id", itemId)
      .eq("event_id", eventId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

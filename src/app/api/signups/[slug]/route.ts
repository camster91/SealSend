import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ slug: string }> };

const claimSchema = z.object({
  item_id: z.string().uuid(),
  claimant_name: z.string().min(1).max(200),
  claimant_email: z.string().email().optional().or(z.literal("")),
});

// GET — list signup items with claims for a public event
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const supabase = createAdminClient();

    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (!event) return NextResponse.json([], { status: 200 });

    const { data: items } = await supabase
      .from("event_signup_items")
      .select("*, claims:event_signup_claims(*)")
      .eq("event_id", event.id)
      .order("sort_order", { ascending: true });

    return NextResponse.json(items ?? []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

// POST — claim a signup item
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ip = getClientIp(request);
    const { success } = await rateLimit(`signup:${ip}`, { max: 20, windowSeconds: 600 });
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { slug } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Verify item exists and belongs to this event
    const { data: item } = await supabase
      .from("event_signup_items")
      .select("id, slots")
      .eq("id", parsed.data.item_id)
      .eq("event_id", event.id)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if slots are available
    const { count } = await supabase
      .from("event_signup_claims")
      .select("*", { count: "exact", head: true })
      .eq("item_id", item.id);

    if (count !== null && count >= item.slots) {
      return NextResponse.json({ error: "All slots are taken" }, { status: 403 });
    }

    const { data: claim, error } = await supabase
      .from("event_signup_claims")
      .insert({
        item_id: parsed.data.item_id,
        event_id: event.id,
        claimant_name: parsed.data.claimant_name,
        claimant_email: parsed.data.claimant_email || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(claim, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

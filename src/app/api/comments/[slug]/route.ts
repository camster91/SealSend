import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { commentSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  try {
    const { slug } = await params;
    const adminSupabase = createAdminClient();

    // Find event by slug (any status — page is already rendered if accessible)
    const { data: event } = await adminSupabase
      .from("events")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!event) {
      return NextResponse.json([], { status: 200 });
    }

    // Only show public comments on the public page
    const { data: comments, error } = await adminSupabase
      .from("event_comments")
      .select("*")
      .eq("event_id", event.id)
      .neq("is_private", true)
      .order("created_at", { ascending: false });

    if (error) {
      // Table might not exist yet — return empty array
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(comments ?? []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(
  request: Request,
  { params }: RouteParams
) {
  try {
    const ip = getClientIp(request);
    const { success } = await rateLimit(`comment:${ip}`, { max: 15, windowSeconds: 600 });
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { slug } = await params;
    const body = await request.json();
    const adminSupabase = createAdminClient();

    // Find event by slug
    const { data: event } = await adminSupabase
      .from("events")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: comment, error } = await adminSupabase
      .from("event_comments")
      .insert({
        event_id: event.id,
        author_name: parsed.data.author_name,
        message: parsed.data.message,
        is_private: parsed.data.is_private ?? false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(comment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

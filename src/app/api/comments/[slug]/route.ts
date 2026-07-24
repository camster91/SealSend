import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { commentSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  try {
    const { slug } = await params;

    // Find published event by slug
    const event = await queryOne<{ id: string }>(
      `SELECT id FROM events WHERE slug = $1 AND status = 'published'`,
      [slug]
    );

    if (!event) {
      return NextResponse.json([], { status: 200 });
    }

    // Only show public comments on the public page
    const comments = await query(
      'SELECT * FROM event_comments WHERE event_id = $1 AND is_private != true ORDER BY created_at DESC',
      [event.id]
    );

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

    // Find published event by slug
    const event = await queryOne<{ id: string }>(
      `SELECT id FROM events WHERE slug = $1 AND status = 'published'`,
      [slug]
    );

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

    const comment = await queryOne(
      `INSERT INTO event_comments (event_id, author_name, message, is_private)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [event.id, parsed.data.author_name, parsed.data.message, parsed.data.is_private ?? false]
    );

    if (!comment) {
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }

    return NextResponse.json(comment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

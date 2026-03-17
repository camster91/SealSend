import { NextResponse } from "next/server";
import { prisma } from '@/lib/db';
import { commentSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  try {
    const { slug } = await params;

    // Find event by slug (any status — page is already rendered if accessible)
    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json([], { status: 200 });
    }

    // Only show public comments on the public page
    const comments = await prisma.eventComment.findMany({
      where: {
        event_id: event.id,
        is_private: { not: true },
      },
      orderBy: { created_at: 'desc' },
    });

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

    // Find event by slug
    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });

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

    const comment = await prisma.eventComment.create({
      data: {
        event_id: event.id,
        author_name: parsed.data.author_name,
        message: parsed.data.message,
        is_private: parsed.data.is_private ?? false,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

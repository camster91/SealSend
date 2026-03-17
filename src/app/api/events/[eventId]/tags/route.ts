import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { prisma } from '@/lib/db';
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

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true },
    });

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tags = await prisma.guestTag.findMany({
      where: { event_id: eventId },
      orderBy: { created_at: 'asc' },
    });

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

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true, tier: true },
    });

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

    const tag = await prisma.guestTag.create({
      data: {
        event_id: eventId,
        tag_name: parsed.data.tag_name,
        color: parsed.data.color,
      },
    });

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

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true },
    });

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = deleteTagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }

    await prisma.guestTag.deleteMany({
      where: { id: parsed.data.tagId, event_id: eventId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

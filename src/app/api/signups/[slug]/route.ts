import { NextResponse } from "next/server";
import { prisma } from '@/lib/db';
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

    const event = await prisma.event.findFirst({
      where: { slug, status: "published" },
      select: { id: true },
    });

    if (!event) return NextResponse.json([], { status: 200 });

    const items = await prisma.eventSignupItem.findMany({
      where: { event_id: event.id },
      include: { claims: true },
      orderBy: { sort_order: 'asc' },
    });

    // Fetch claims for all items
    const itemIds = items.map((i: any) => i.id);
    let claims: any[] = [];
    if (itemIds.length > 0) {
      claims = await query(
        'SELECT * FROM event_signup_claims WHERE item_id = ANY($1)',
        [itemIds]
      );
    }

    // Attach claims to items
    const itemsWithClaims = items.map((item: any) => ({
      ...item,
      claims: claims.filter((c: any) => c.item_id === item.id),
    }));

    return NextResponse.json(itemsWithClaims);
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

    const event = await prisma.event.findFirst({
      where: { slug, status: "published" },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Verify item exists and belongs to this event
    const item = await prisma.eventSignupItem.findFirst({
      where: { id: parsed.data.item_id, event_id: event.id },
      select: { id: true, slots: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if slots are available
    const count = await prisma.eventSignupClaim.count({
      where: { item_id: item.id },
    });

    if (count >= item.slots) {
      return NextResponse.json({ error: "All slots are taken" }, { status: 403 });
    }

    const claim = await prisma.eventSignupClaim.create({
      data: {
        item_id: parsed.data.item_id,
        event_id: event.id,
        claimant_name: parsed.data.claimant_name,
        claimant_email: parsed.data.claimant_email || null,
      },
    });

    return NextResponse.json(claim, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

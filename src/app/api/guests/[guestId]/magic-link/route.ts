import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/db';
import { getApiUser } from "@/lib/auth/api-auth";
import { query, queryOne } from "@/lib/db/client";
import { randomBytes, createHash } from "crypto";
import { rateLimit } from "@/lib/rate-limit";

// Generate a secure random token (URL-safe base64)
function generateSecureToken(): string {
  // 32 bytes = 256 bits of entropy
  return randomBytes(32).toString("base64url");
}

// Hash token for storage (SHA-256)
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Get token preview (last 4 chars)
function getTokenPreview(token: string): string {
  return token.slice(-4);
}

type RouteParams = { params: Promise<{ guestId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { guestId } = await params;

    // Authenticate user
    const user = await getApiUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 10 magic link generations per user per hour
    const { success: rateLimitOk } = rateLimit(`magic-link:${user.id}`, {
      max: 10,
      windowSeconds: 3600
    });

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many magic link requests. Please try again later." },
        { status: 429 }
      );
    }

    // Get guest and verify ownership through event
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { id: true, event_id: true, name: true, email: true, invite_token: true },
    });

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Verify user owns the event
    const event = await prisma.event.findUnique({
      where: { id: guest.event_id },
      select: { id: true, user_id: true, slug: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.user_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have permission to generate magic links for this guest" },
        { status: 403 }
      );
    }

    // Generate secure token
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const tokenPreview = getTokenPreview(rawToken);

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store hashed token in database
    const magicToken = await prisma.guestMagicToken.create({
      data: {
        guest_id: guestId,
        event_id: guest.event_id,
        token_hash: tokenHash,
        token_preview: tokenPreview,
        expires_at: expiresAt.toISOString(),
      },
    });

    // Build the magic link URL (using the raw token - this is the only time it's exposed)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
    const magicLink = `${siteUrl}/guest/update/${rawToken}`;

    return NextResponse.json({
      success: true,
      magicLink,
      tokenPreview,
      expiresAt: expiresAt.toISOString(),
      guest: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
      },
    });
  } catch (error) {
    console.error("Magic link generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to list active magic links for a guest
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { guestId } = await params;

    const user = await getApiUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get guest and verify ownership
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { id: true, event_id: true },
    });

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Verify user owns the event
    const event = await prisma.event.findUnique({
      where: { id: guest.event_id },
      select: { user_id: true },
    });

    if (!event || event.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get active (non-expired, non-used) magic tokens
    const tokens = await prisma.guestMagicToken.findMany({
      where: {
        guest_id: guestId,
        expires_at: { gt: new Date().toISOString() },
        used_at: null,
      },
      select: { id: true, token_preview: true, expires_at: true, used_at: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      tokens: tokens || [],
    });
  } catch (error) {
    console.error("Magic link list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

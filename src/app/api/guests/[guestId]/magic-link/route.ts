import { NextRequest, NextResponse } from "next/server";
import { requireApiHost } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { generateMagicToken, hashMagicToken, previewMagicToken } from '@/lib/magic-token';

type RouteParams = { params: Promise<{ guestId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { guestId } = await params;

    // Authenticate host
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Rate limit: 10 magic link generations per user per hour
    const { success: rateLimitOk } = await rateLimit(`magic-link:${user.id}`, {
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
    const guest = await queryOne<{ id: string; event_id: string; name: string; email: string | null; invite_token: string | null }>(
      'SELECT id, event_id, name, email, invite_token FROM guests WHERE id = $1',
      [guestId]
    );

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Verify user owns the event
    const event = await queryOne<{ id: string; user_id: string; slug: string }>(
      'SELECT id, user_id, slug FROM events WHERE id = $1',
      [guest.event_id]
    );

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
    const rawToken = generateMagicToken();
    const tokenHash = hashMagicToken(rawToken);
    const tokenPreview = previewMagicToken(rawToken);

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store hashed token in database
    const magicToken = await queryOne(
      'INSERT INTO guest_magic_tokens (guest_id, event_id, token_hash, token_preview, expires_at, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [guestId, guest.event_id, tokenHash, tokenPreview, expiresAt.toISOString(), user.id]
    );

    if (!magicToken) {
      console.error("Failed to create magic token");
      return NextResponse.json(
        { error: "Failed to generate magic link" },
        { status: 500 }
      );
    }

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

    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Get guest and verify ownership
    const guest = await queryOne<{ id: string; event_id: string }>(
      'SELECT id, event_id FROM guests WHERE id = $1',
      [guestId]
    );

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Verify user owns the event
    const event = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM events WHERE id = $1',
      [guest.event_id]
    );

    if (!event || event.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get active (non-expired, non-used) magic tokens
    const tokens = await query(
      'SELECT id, token_preview, expires_at, used_at, created_at FROM guest_magic_tokens WHERE guest_id = $1 AND expires_at > $2 AND used_at IS NULL ORDER BY created_at DESC',
      [guestId, new Date().toISOString()]
    );

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

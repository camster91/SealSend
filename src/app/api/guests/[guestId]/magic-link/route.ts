import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/auth/api-auth";
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

    const adminSupabase = createAdminClient();

    // Get guest and verify ownership through event
    const { data: guest, error: guestError } = await adminSupabase
      .from("guests")
      .select("id, event_id, name, email, invite_token")
      .eq("id", guestId)
      .single();

    if (guestError || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Verify user owns the event
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("id, user_id, slug")
      .eq("id", guest.event_id)
      .single();

    if (eventError || !event) {
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
    const { data: magicToken, error: insertError } = await adminSupabase
      .from("guest_magic_tokens")
      .insert({
        guest_id: guestId,
        event_id: guest.event_id,
        token_hash: tokenHash,
        token_preview: tokenPreview,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create magic token:", insertError);
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
    
    const user = await getApiUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // Get guest and verify ownership
    const { data: guest, error: guestError } = await adminSupabase
      .from("guests")
      .select("id, event_id")
      .eq("id", guestId)
      .single();

    if (guestError || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Verify user owns the event
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("user_id")
      .eq("id", guest.event_id)
      .single();

    if (eventError || !event || event.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get active (non-expired, non-used) magic tokens
    const { data: tokens, error: tokensError } = await adminSupabase
      .from("guest_magic_tokens")
      .select("id, token_preview, expires_at, used_at, created_at")
      .eq("guest_id", guestId)
      .gt("expires_at", new Date().toISOString())
      .is("used_at", null)
      .order("created_at", { ascending: false });

    if (tokensError) {
      console.error("Failed to fetch magic tokens:", tokensError);
      return NextResponse.json(
        { error: "Failed to fetch magic links" },
        { status: 500 }
      );
    }

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

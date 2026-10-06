import { createHmac, timingSafeEqual } from "node:crypto";
import {
  recordCommunicationSuppression,
  type CommunicationSuppressionClient,
} from "@/lib/communication-suppressions";

/**
 * Signed one-click unsubscribe links for guest emails.
 *
 * A token is `base64url(JSON [ownerUserId, email]).base64url(HMAC-SHA256)`.
 * It names the event owner, because an unsubscribe stops emails from that
 * host only (the communication_suppressions table is keyed by owner). The
 * token is the only authorization, so it must never be guessable or reusable
 * for another address or another host.
 */

// Domain-separates these signatures from other SESSION_SECRET HMACs.
const SIGNING_CONTEXT = "sealsend:unsubscribe:v1:";
const MAX_TOKEN_LENGTH = 2048;

function signingSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET or SESSION_SECRET must be set to sign unsubscribe links");
  }
  return secret;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(SIGNING_CONTEXT + payload).digest();
}

export function createUnsubscribeToken(ownerUserId: string, email: string): string {
  const owner = ownerUserId.trim();
  const normalized = normalizeEmail(email);
  if (!owner) throw new Error("Unsubscribe token needs the event owner");
  if (!normalized) throw new Error("Unsubscribe token needs an email address");
  const payload = Buffer.from(JSON.stringify([owner, normalized]), "utf8").toString("base64url");
  return `${payload}.${sign(payload, signingSecret()).toString("base64url")}`;
}

/** Returns the owner and email the token was made for, or null for anything forged, altered or malformed. Never throws. */
export function verifyUnsubscribeToken(token: string): { ownerUserId: string; email: string } | null {
  try {
    if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;

    const expected = sign(payload, signingSecret());
    const given = Buffer.from(signature, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== 2) return null;
    const [ownerUserId, email] = decoded;
    if (typeof ownerUserId !== "string" || typeof email !== "string" || !ownerUserId || !email) return null;
    return { ownerUserId, email };
  } catch {
    return null;
  }
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
}

/** The page a guest opens from the footer link. */
export function unsubscribeUrl(ownerUserId: string, email: string): string {
  return `${siteUrl()}/unsubscribe/${createUnsubscribeToken(ownerUserId, email)}`;
}

/** The endpoint mail providers POST to for RFC 8058 one-click unsubscribe. */
export function unsubscribeApiUrl(ownerUserId: string, email: string): string {
  return `${siteUrl()}/api/unsubscribe/${createUnsubscribeToken(ownerUserId, email)}`;
}

export function listUnsubscribeHeaders(ownerUserId: string, email: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeApiUrl(ownerUserId, email)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export type UnsubscribeResult = { status: 200; body: { ok: true } } | { status: 400; body: { ok: false; error: string } };

/**
 * Verify the token and stop email from that host to that address. Safe to
 * repeat: the suppression upsert leaves one row however often it is clicked.
 */
export async function handleUnsubscribe(token: string, client: CommunicationSuppressionClient): Promise<UnsubscribeResult> {
  const target = verifyUnsubscribeToken(token);
  if (!target) return { status: 400, body: { ok: false, error: "This link isn't valid." } };
  try {
    await recordCommunicationSuppression(client, {
      userId: target.ownerUserId,
      channel: "email",
      recipient: target.email,
      reason: "unsubscribed",
      provider: "manual",
    });
  } catch (error) {
    // The host's account is gone (foreign key violation), so nothing can email this guest any more.
    if ((error as { code?: string } | null)?.code !== "23503") throw error;
  }
  return { status: 200, body: { ok: true } };
}

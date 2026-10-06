import { createHmac, timingSafeEqual } from "node:crypto";
import {
  recordCommunicationSuppression,
  type CommunicationSuppressionClient,
} from "@/lib/communication-suppressions";

/**
 * Signed one-click unsubscribe links for guest emails.
 *
 * A token is `base64url(JSON [ownerUserId, email, eventId]).base64url(HMAC-SHA256)`.
 * It names the event owner, because an unsubscribe stops emails from that
 * host only (the communication_suppressions table is keyed by owner); the
 * event id only lets the page show the host name that event's email used. The
 * token is the only authorization, so it must never be guessable or reusable
 * for another address or another host.
 */

// Domain-separates these signatures from other SESSION_SECRET HMACs.
const SIGNING_CONTEXT = "sealsend:unsubscribe:v1:";
const MAX_TOKEN_LENGTH = 2048;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

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

export type UnsubscribeTarget = { ownerUserId: string; email: string; eventId: string };

/**
 * The event id is for display only (the page names the host the way that
 * event's footer did); the unsubscribe itself always applies to the owner.
 */
export function createUnsubscribeToken(ownerUserId: string, email: string, eventId: string): string {
  const owner = ownerUserId.trim();
  const normalized = normalizeEmail(email);
  const event = eventId.trim();
  if (!owner) throw new Error("Unsubscribe token needs the event owner");
  if (!normalized) throw new Error("Unsubscribe token needs an email address");
  if (!event) throw new Error("Unsubscribe token needs the event");
  const payload = Buffer.from(JSON.stringify([owner, normalized, event]), "utf8").toString("base64url");
  return `${payload}.${sign(payload, signingSecret()).toString("base64url")}`;
}

/** Returns what the token was made for, or null for anything forged, altered or malformed. Never throws. */
export function verifyUnsubscribeToken(token: string): UnsubscribeTarget | null {
  try {
    if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;

    const expected = sign(payload, signingSecret());
    const given = Buffer.from(signature, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== 3) return null;
    const [ownerUserId, email, eventId] = decoded;
    if (!isFilledString(ownerUserId) || !isFilledString(email) || !isFilledString(eventId)) return null;
    return { ownerUserId, email, eventId };
  } catch {
    return null;
  }
}

function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
}

/** The page a guest opens from the footer link. */
export function unsubscribeUrl(ownerUserId: string, email: string, eventId: string): string {
  return `${siteUrl()}/unsubscribe/${createUnsubscribeToken(ownerUserId, email, eventId)}`;
}

/** The endpoint mail providers POST to for RFC 8058 one-click unsubscribe. */
export function unsubscribeApiUrl(ownerUserId: string, email: string, eventId: string): string {
  return `${siteUrl()}/api/unsubscribe/${createUnsubscribeToken(ownerUserId, email, eventId)}`;
}

export function listUnsubscribeHeaders(ownerUserId: string, email: string, eventId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeApiUrl(ownerUserId, email, eventId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export type UnsubscribeResult =
  | { status: 200; body: { ok: true } }
  | { status: 400 | 429; body: { ok: false; error: string } };

/**
 * Verify the token and stop email from that host to that address.
 *
 * A valid token is never rate-limited: mail providers send RFC 8058 one-click
 * POSTs from shared IPs, and a 429 there would lose a legally required
 * opt-out. It is idempotent instead. Only invalid tokens consult
 * `allowInvalidAttempt` (a per-IP limiter), which stops token guessing from
 * flooding the endpoint.
 */
export async function handleUnsubscribe(
  token: string,
  client: CommunicationSuppressionClient,
  allowInvalidAttempt: () => Promise<boolean>,
): Promise<UnsubscribeResult> {
  const target = verifyUnsubscribeToken(token);
  if (!target) {
    if (!(await allowInvalidAttempt())) {
      return { status: 429, body: { ok: false, error: "Too many tries. Please wait a minute and try again." } };
    }
    return { status: 400, body: { ok: false, error: "This link isn't valid." } };
  }
  try {
    await recordCommunicationSuppression(client, {
      userId: target.ownerUserId,
      channel: "email",
      recipient: target.email,
      reason: "unsubscribed",
      provider: "manual",
      // An existing bounce or complaint row stays as it is: the guest is already suppressed.
      keepExisting: true,
    });
  } catch (error) {
    // The host's account is gone (foreign key violation), so nothing can email this guest any more.
    if ((error as { code?: string } | null)?.code !== "23503") throw error;
  }
  return { status: 200, body: { ok: true } };
}

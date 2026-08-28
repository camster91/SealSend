import { createHmac, timingSafeEqual } from "node:crypto";
import type { MessageAudience } from "@/lib/messages/audience";

export type AnnouncementApproval = {
  eventId: string;
  userId: string;
  subject: string;
  message: string;
  audience: MessageAudience;
  channels: Array<"email" | "sms">;
  sendAt: string | null;
};

const PROOF_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be configured for announcement approval proofs");
  return value;
}

function canonicalPayload(input: AnnouncementApproval, expiresAt: number): string {
  return JSON.stringify({
    ...input,
    audience: {
      rsvpStatuses: [...input.audience.rsvpStatuses].sort(),
      invitationStatuses: [...input.audience.invitationStatuses].sort(),
      tagIds: [...input.audience.tagIds].sort(),
      unansweredOnly: input.audience.unansweredOnly,
    },
    channels: [...input.channels].sort(),
    expiresAt,
  });
}

export function createAnnouncementApprovalProof(input: AnnouncementApproval, now = Date.now()): string {
  const expiresAt = now + PROOF_TTL_MS;
  const signature = createHmac("sha256", secret()).update(canonicalPayload(input, expiresAt)).digest("base64url");
  return `${expiresAt}.${signature}`;
}

export function verifyAnnouncementApprovalProof(input: AnnouncementApproval, proof: string, now = Date.now()): boolean {
  const [expiresRaw, suppliedSignature, ...extra] = proof.split(".");
  const expiresAt = Number(expiresRaw);
  if (extra.length || !Number.isSafeInteger(expiresAt) || expiresAt < now || expiresAt > now + PROOF_TTL_MS) return false;
  const expected = createHmac("sha256", secret()).update(canonicalPayload(input, expiresAt)).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(suppliedSignature || "", "base64url"); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

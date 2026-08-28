const PARTICIPANT_LABEL_PATTERN = /^host-[a-f0-9]{12}$/;

export type BetaInviteStatus = "available" | "accepted" | "revoked" | "expired";

export function parseBetaInviteLabel(input: unknown): string {
  if (typeof input !== "string" || !PARTICIPANT_LABEL_PATTERN.test(input)) {
    throw new Error("Expected a pseudonymous beta participant label such as host-abcdef123456");
  }
  return input;
}

export function classifyBetaInvite(
  invite: {
    acceptedAt: string | null;
    revokedAt: string | null;
    expiresAt: string;
  },
  now = new Date(),
): BetaInviteStatus {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return "expired";
  return "available";
}

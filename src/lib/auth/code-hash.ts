import { createHmac } from "node:crypto";

export function hashAuthCode(input: { code: string; recipient: string; role: "admin" | "guest"; eventId?: string | null }): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be configured to hash authentication codes");
  return createHmac("sha256", secret)
    .update(`${input.code}\0${input.recipient.trim().toLowerCase()}\0${input.role}\0${input.eventId ?? ""}`)
    .digest("hex");
}

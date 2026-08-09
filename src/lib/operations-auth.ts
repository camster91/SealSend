import { timingSafeEqual } from "node:crypto";

export function isOperationsAuthorized(authorization: string | null, secret = process.env.OPERATIONS_SECRET): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

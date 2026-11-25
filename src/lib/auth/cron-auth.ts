import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time Bearer token check for /api/cron/* routes.
 * Hashes both sides to fixed 32-byte digests so length differences never leak.
 */
export function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const expected = createHash("sha256").update(`Bearer ${cronSecret}`).digest();
  const actual = createHash("sha256").update(authHeader).digest();
  return timingSafeEqual(expected, actual);
}

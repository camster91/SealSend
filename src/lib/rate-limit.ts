import { query } from "@/lib/db/client";

interface RateLimitOptions {
  /** Max requests allowed in the window */
  max: number;
  /** Window size in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export async function rateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - options.windowSeconds * 1000);
  const resetAt = now.getTime() + options.windowSeconds * 1000;

  // Delete old entries older than window
  await query(
    'DELETE FROM rate_limit_attempts WHERE key = $1 AND created_at < $2',
    [key, windowStart.toISOString()]
  );

  // Count recent entries for the key
  const rows = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM rate_limit_attempts WHERE key = $1 AND created_at >= $2',
    [key, windowStart.toISOString()]
  );

  const currentCount = parseInt(rows[0]?.count ?? '0', 10);

  if (currentCount >= options.max) {
    return { success: false, remaining: 0, resetAt };
  }

  // Insert new entry
  await query('INSERT INTO rate_limit_attempts (key) VALUES ($1)', [key]);

  return {
    success: true,
    remaining: options.max - currentCount - 1,
    resetAt,
  };
}

/** Extract client IP from request headers */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

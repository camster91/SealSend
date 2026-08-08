import { getDb } from "@/lib/db/client";

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
  const client = await getDb().connect();

  try {
    await client.query('BEGIN');

    // Serialize only attempts for this key. This closes the race where parallel
    // requests could all count below the limit before any of them inserted.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [key]
    );

    await client.query(
      'DELETE FROM rate_limit_attempts WHERE key = $1 AND created_at < $2',
      [key, windowStart.toISOString()]
    );

    const result = await client.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM rate_limit_attempts WHERE key = $1 AND created_at >= $2',
      [key, windowStart.toISOString()]
    );

    const currentCount = parseInt(result.rows[0]?.count ?? '0', 10);

    if (currentCount >= options.max) {
      await client.query('COMMIT');
      return { success: false, remaining: 0, resetAt };
    }

    await client.query('INSERT INTO rate_limit_attempts (key) VALUES ($1)', [key]);
    await client.query('COMMIT');

    return {
      success: true,
      remaining: options.max - currentCount - 1,
      resetAt,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

function isPlausibleIp(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 45) return false;
  if (IPV4_RE.test(v)) {
    return v.split('.').every((octet) => {
      const n = Number(octet);
      return n >= 0 && n <= 255;
    });
  }
  return IPV6_RE.test(v) && v.includes(':');
}

/**
 * Extract client IP from request headers.
 * Prefer x-real-ip (set by trusted reverse proxy). Only use the left-most
 * x-forwarded-for hop when TRUST_PROXY_HEADERS=true (Coolify/nginx setups).
 */
export function getClientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY_HEADERS === 'true';

  if (trustProxy) {
    const realIp = request.headers.get("x-real-ip");
    if (realIp && isPlausibleIp(realIp)) {
      return realIp.trim();
    }

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded && isPlausibleIp(forwarded)) {
      return forwarded;
    }
  }

  return "unknown";
}

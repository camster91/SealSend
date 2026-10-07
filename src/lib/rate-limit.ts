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
  return consumeQuota(key, 1, options);
}

/**
 * Reserve `units` attempts at once against a sliding window (e.g. one unit per
 * email in a batch). All-or-nothing: if the batch doesn't fit, nothing is
 * recorded and `remaining` says how many units are still free.
 */
export async function consumeQuota(
  key: string,
  units: number,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  if (!Number.isInteger(units) || units < 1) {
    throw new Error("consumeQuota units must be a positive integer");
  }
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

    if (currentCount + units > options.max) {
      await client.query('COMMIT');
      return { success: false, remaining: Math.max(0, options.max - currentCount), resetAt };
    }

    await client.query(
      'INSERT INTO rate_limit_attempts (key) SELECT $1 FROM generate_series(1, $2::int)',
      [key, units]
    );
    await client.query('COMMIT');

    return {
      success: true,
      remaining: options.max - currentCount - units,
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

/** Units still free in the window. Read-only: never records an attempt. */
export async function remainingQuota(
  key: string,
  max: number,
  windowSeconds: number,
  db: { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ count: string }> }> } = getDb(),
): Promise<number> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000);
  const result = await db.query(
    'SELECT COUNT(*) AS count FROM rate_limit_attempts WHERE key = $1 AND created_at >= $2',
    [key, windowStart.toISOString()],
  );
  const used = parseInt(result.rows[0]?.count ?? '0', 10);
  return Math.max(0, max - used);
}

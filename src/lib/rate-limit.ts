import { batch, query } from "@/lib/db/client";

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

  // One batch, so no other attempt for this key runs between the count and the insert
  // (D1 runs batches one at a time). The insert only happens if the units still fit.
  const [, counted] = await batch<{ count: number }>([
    {
      text: 'DELETE FROM rate_limit_attempts WHERE key = $1 AND created_at < $2',
      params: [key, windowStart],
    },
    {
      text: 'SELECT COUNT(*) AS count FROM rate_limit_attempts WHERE key = $1 AND created_at >= $2',
      params: [key, windowStart],
    },
    {
      text: `WITH RECURSIVE units(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM units WHERE n < $2)
             INSERT INTO rate_limit_attempts (key)
             SELECT $1 FROM units
              WHERE (SELECT COUNT(*) FROM rate_limit_attempts WHERE key = $1 AND created_at >= $3) + $2 <= $4`,
      params: [key, units, windowStart, options.max],
    },
  ]);

  const currentCount = Number(counted[0]?.count ?? 0);

  if (currentCount + units > options.max) {
    return { success: false, remaining: Math.max(0, options.max - currentCount), resetAt };
  }

  return {
    success: true,
    remaining: options.max - currentCount - units,
    resetAt,
  };
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
 * Behind Cloudflare, set TRUST_CF_CONNECTING_IP=true: Cloudflare overwrites
 * CF-Connecting-IP on every request, so clients can't forge it (unlike the
 * left-most x-forwarded-for hop).
 */
export function getClientIp(request: Request): string {
  if (process.env.TRUST_CF_CONNECTING_IP === 'true') {
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp && isPlausibleIp(cfIp)) {
      return cfIp.trim();
    }
  }

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
  db: { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ count: number | string }> }> } = {
    query: async (text, params) => ({ rows: await query<{ count: number }>(text, params) }),
  },
): Promise<number> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000);
  const result = await db.query(
    'SELECT COUNT(*) AS count FROM rate_limit_attempts WHERE key = $1 AND created_at >= $2',
    [key, windowStart],
  );
  const used = Number(result.rows[0]?.count ?? 0);
  return Math.max(0, max - used);
}

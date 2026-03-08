/**
 * Rate limiting with Redis (production) or in-memory fallback (development)
 * 
 * Uses @upstash/redis and @upstash/ratelimit for production.
 * Falls back to in-memory store when REDIS_URL is not configured.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

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

// Redis-based rate limiter (production)
let redisRatelimit: Ratelimit | null = null;

// In-memory store (development/fallback)
interface MemoryRateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryRateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Initialize Redis rate limiter if REDIS_URL is available
 */
function initRedisRatelimit() {
  if (redisRatelimit) return redisRatelimit;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('⚠️  REDIS_URL not configured, using in-memory rate limiting');
    return null;
  }

  try {
    // Parse Redis URL (supports Upstash and standard Redis URLs)
    let token: string | undefined;
    let url: string | undefined;

    if (redisUrl.includes('@')) {
      // Upstash format: https://<user>:<token>@<host>:<port>
      const urlParts = new URL(redisUrl);
      token = urlParts.username;
      url = `https://${urlParts.hostname}${urlParts.port ? `:${urlParts.port}` : ''}`;
    } else {
      // Standard Redis URL: redis://...
      url = redisUrl;
    }

    const redis = new Redis({
      url,
      token,
    });

    redisRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow,
      analytics: true,
    });

    console.log('✅ Redis rate limiting initialized');
    return redisRatelimit;
  } catch (error) {
    console.error('❌ Failed to initialize Redis rate limiting:', error);
    return null;
  }
}

/**
 * In-memory rate limiter (fallback)
 */
function memoryRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + options.windowSeconds * 1000;
    memoryStore.set(key, { count: 1, resetAt });
    return { success: true, remaining: options.max - 1, resetAt };
  }

  if (entry.count >= options.max) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    success: true,
    remaining: options.max - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Main rate limit function
 * Uses Redis if available, otherwise falls back to in-memory
 */
export async function rateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const ratelimit = initRedisRatelimit();
  
  if (ratelimit) {
    try {
      const result = await ratelimit.limit(key, {
        rate: options.max,
        window: `${options.windowSeconds}s`,
      });
      
      return {
        success: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (error) {
      console.error('Redis rate limit error, falling back to in-memory:', error);
      // Fall back to in-memory
    }
  }

  // Use in-memory rate limiting
  return memoryRateLimit(key, options);
}

/**
 * Synchronous version for compatibility with existing code
 * Note: This is deprecated and will be removed. Use async version instead.
 */
export function rateLimitSync(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  console.warn('⚠️ rateLimitSync is deprecated, use async rateLimit instead');
  return memoryRateLimit(key, options);
}

/** Extract client IP from request headers */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Helper for API routes to check rate limits
 */
export async function checkRateLimit(
  request: Request,
  identifier: string,
  options: RateLimitOptions = { max: 10, windowSeconds: 60 }
): Promise<{ success: boolean; response?: Response }> {
  const ip = getClientIp(request);
  const key = `${identifier}:${ip}`;
  
  const result = await rateLimit(key, options);
  
  if (!result.success) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded', 
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000) 
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': options.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt.toString(),
          },
        }
      ),
    };
  }
  
  return { success: true };
}
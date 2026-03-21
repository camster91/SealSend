import { createAdminClient } from "@/lib/supabase/admin";

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
  const supabase = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - options.windowSeconds * 1000);
  const resetAt = now.getTime() + options.windowSeconds * 1000;

  // Delete old entries older than window
  await supabase
    .from("rate_limit_attempts")
    .delete()
    .eq("key", key)
    .lt("created_at", windowStart.toISOString());

  // Count recent entries for the key
  const { count } = await supabase
    .from("rate_limit_attempts")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart.toISOString());

  const currentCount = count ?? 0;

  if (currentCount >= options.max) {
    return { success: false, remaining: 0, resetAt };
  }

  // Insert new entry
  await supabase.from("rate_limit_attempts").insert({ key });

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

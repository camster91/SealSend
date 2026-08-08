import { queryOne } from "@/lib/db/client";
import { BETA_MODE } from "@/lib/constants";
import type { AccountPlan } from "@/lib/entitlements";

export async function getUserTier(userId: string): Promise<AccountPlan> {
  if (BETA_MODE) return "pro_annual";

  const data = await queryOne<{ tier: string; status: string }>(
    "SELECT tier, status FROM user_subscriptions WHERE user_id = $1 AND status IN ('active', 'trialing') LIMIT 1",
    [userId]
  );

  return data?.tier === "pro_annual" ? "pro_annual" : "free";
}

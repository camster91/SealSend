import { queryOne } from "@/lib/db/client";
import { BETA_MODE, SUBSCRIPTION_TIERS } from "@/lib/constants";

export async function getUserTier(userId: string): Promise<string> {
  if (BETA_MODE) return "business";

  const data = await queryOne<{ tier: string; status: string }>(
    "SELECT tier, status FROM user_subscriptions WHERE user_id = $1 AND status IN ('active', 'trialing') LIMIT 1",
    [userId]
  );

  return data?.tier ?? "free";
}

export function getTierLimits(tier: string) {
  const tierConfig = SUBSCRIPTION_TIERS.find((t) => t.id === tier);
  return tierConfig?.limits ?? { events: 1, guestsPerEvent: 50, responses: 100, teamMembers: 1, storageGB: 0.5 };
}

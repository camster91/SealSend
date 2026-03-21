import { createAdminClient } from "@/lib/supabase/admin";
import { BETA_MODE, SUBSCRIPTION_TIERS } from "@/lib/constants";

export async function getUserTier(userId: string): Promise<string> {
  if (BETA_MODE) return "business";

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .single();

  return data?.tier ?? "free";
}

export function getTierLimits(tier: string) {
  const tierConfig = SUBSCRIPTION_TIERS.find((t) => t.id === tier);
  return tierConfig?.limits ?? { events: 1, guestsPerEvent: 50, responses: 100, teamMembers: 1, storageGB: 0.5 };
}

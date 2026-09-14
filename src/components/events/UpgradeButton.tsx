"use client";

import { useState } from "react";
import { BETA_MODE } from "@/lib/constants";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { useToast } from "@/components/ui/Toast";

type UpgradeTier = "silver" | "gold" | "platinum" | "diamond";

interface TierInfo {
  name: string;
  price: string;
  style: string;
}

const UPGRADE_TIERS: Record<UpgradeTier, TierInfo> = {
  silver: {
    name: "Silver",
    price: "$8.99",
    style: "bg-brand-600 text-white hover:bg-brand-700",
  },
  gold: {
    name: "Gold",
    price: "$17.99",
    style: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:shadow-md",
  },
  platinum: {
    name: "Platinum",
    price: "$34.99",
    style: "bg-gradient-to-r from-slate-500 to-slate-700 text-white shadow-sm hover:shadow-md",
  },
  diamond: {
    name: "Diamond",
    price: "$49.99",
    style: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm hover:shadow-md",
  },
};

const TIER_RANK: Record<string, number> = {
  free: 0,
  silver: 1,
  standard: 1,
  gold: 2,
  premium: 2,
  platinum: 3,
  diamond: 4,
};

interface UpgradeButtonProps {
  eventId: string;
  currentTier: string;
}

export function UpgradeButton({ eventId, currentTier }: UpgradeButtonProps) {
  const toast = useToast();
  const [loading, setLoading] = useState<UpgradeTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (BETA_MODE) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        All features unlocked (Beta)
      </span>
    );
  }

  const currentRank = TIER_RANK[currentTier] ?? 0;

  const availableUpgrades = (Object.keys(UPGRADE_TIERS) as UpgradeTier[]).filter(
    (tier) => (TIER_RANK[tier] ?? 0) > currentRank
  );

  if (availableUpgrades.length === 0) return null;

  async function handleUpgrade(tier: UpgradeTier) {
    setCheckoutError(null);
    setLoading(tier);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, tier }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || "Failed to create checkout session";
        setCheckoutError(msg);
        toast.error(msg);
        return;
      }

      window.location.href = data.url;
    } catch {
      const msg = "Something went wrong. Please try again.";
      setCheckoutError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {checkoutError && (
        <InlineBanner
          variant="error"
          onDismiss={() => setCheckoutError(null)}
          className="mb-3"
        >
          {checkoutError}
        </InlineBanner>
      )}
      <div className="flex flex-wrap gap-2">
        {availableUpgrades.map((tier) => {
        const info = UPGRADE_TIERS[tier];
        const isLoading = loading === tier;
        return (
          <button
            key={tier}
            onClick={() => handleUpgrade(tier)}
            disabled={loading !== null}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 disabled:opacity-50 ${info.style}`}
          >
            {isLoading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )}
            {info.name} {info.price}
          </button>
        );
        })}
      </div>
    </div>
  );
}

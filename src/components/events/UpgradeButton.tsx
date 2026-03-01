"use client";

import { useState } from "react";
import { TIERS, BETA_MODE } from "@/lib/constants";

type UpgradeTier = "standard" | "premium";

interface UpgradeButtonProps {
  eventId: string;
  currentTier: string;
}

export function UpgradeButton({ eventId, currentTier }: UpgradeButtonProps) {
  const [loading, setLoading] = useState<UpgradeTier | null>(null);

  // During beta, all features are free — hide upgrade buttons
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

  const tierRank = { free: 0, standard: 1, premium: 2 } as const;
  const currentRank = tierRank[currentTier as keyof typeof tierRank] ?? 0;

  const availableUpgrades: UpgradeTier[] = [];
  if (currentRank < 1) availableUpgrades.push("standard");
  if (currentRank < 2) availableUpgrades.push("premium");

  if (availableUpgrades.length === 0) return null;

  async function handleUpgrade(tier: UpgradeTier) {
    setLoading(tier);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, tier }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to create checkout session");
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {availableUpgrades.map((tier) => {
        const tierInfo = TIERS[tier];
        const isLoading = loading === tier;
        return (
          <button
            key={tier}
            onClick={() => handleUpgrade(tier)}
            disabled={loading !== null}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${
              tier === "premium"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:shadow-md"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
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
            {tierInfo.name} ${tierInfo.price}
          </button>
        );
      })}
    </div>
  );
}

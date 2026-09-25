"use client";

import { useState } from "react";
import { BETA_MODE, EVENT_PASS } from "@/lib/constants";
import { isEventTierUpgrade } from "@/lib/entitlements";

interface UpgradeButtonProps {
  eventId: string;
  currentTier: string;
}

export function UpgradeButton({ eventId, currentTier }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
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

  if (!isEventTierUpgrade(currentTier, "event_pass")) return null;

  async function handleUpgrade() {
    setCheckoutError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, tier: "event_pass" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCheckoutError(data.error || "Failed to create checkout session");
        return;
      }

      window.location.href = data.url;
    } catch {
      setCheckoutError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {checkoutError && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {checkoutError}
        </div>
      )}
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        )}
        {EVENT_PASS.name} ${(EVENT_PASS.priceCents / 100).toFixed(2)} · up to {EVENT_PASS.guestsPerEvent} guests
      </button>
    </div>
  );
}

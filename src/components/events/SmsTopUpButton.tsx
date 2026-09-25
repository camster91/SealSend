"use client";

import { useState } from "react";
import { SMS_TOP_UP } from "@/lib/constants";

export function SmsTopUpButton({ eventId, balance }: { eventId: string; balance: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTopUp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/sms-top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Unable to start checkout. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={balance <= 0 ? "font-semibold text-red-700" : "text-gray-600"}>
        {Math.max(0, balance)} SMS segments left
      </span>
      <button
        type="button"
        onClick={handleTopUp}
        disabled={loading}
        className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? "Opening checkout…" : `Add ${SMS_TOP_UP.segments} SMS · $${(SMS_TOP_UP.priceCents / 100).toFixed(2)}`}
      </button>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

interface PlanCheckoutClientProps {
  plan: string;
}

const VALID_PLANS = ["pro", "business"];

export function PlanCheckoutClient({ plan }: PlanCheckoutClientProps) {
  const [status, setStatus] = useState<"loading" | "error" | "redirecting">("loading");

  useEffect(() => {
    if (!VALID_PLANS.includes(plan)) {
      setStatus("error");
      return;
    }

    async function initiateCheckout() {
      try {
        const res = await fetch("/api/subscriptions/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: plan, billing: "monthly" }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Checkout error:", data.error);
          setStatus("error");
          return;
        }

        setStatus("redirecting");
        window.location.href = data.url;
      } catch {
        setStatus("error");
      }
    }

    initiateCheckout();
  }, [plan]);

  if (status === "error") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="text-center">
        <svg className="mx-auto h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="mt-3 text-sm font-medium text-gray-700">
          Setting up your plan...
        </p>
      </div>
    </div>
  );
}

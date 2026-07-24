"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PlanCheckoutClientProps {
  plan: string;
}

const VALID_PLANS = ["pro", "business"];

export function PlanCheckoutClient({ plan }: PlanCheckoutClientProps) {
  const [status, setStatus] = useState<"loading" | "error" | "redirecting">("loading");
  const [errorMessage, setErrorMessage] = useState("Unable to start checkout. Please try again.");

  useEffect(() => {
    if (!VALID_PLANS.includes(plan)) {
      setErrorMessage("Invalid plan selected.");
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

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setErrorMessage(data.error || "Unable to start checkout. Please try again.");
          setStatus("error");
          return;
        }

        if (!data.url) {
          setErrorMessage("Checkout session was incomplete. Please try again.");
          setStatus("error");
          return;
        }

        setStatus("redirecting");
        window.location.href = data.url;
      } catch {
        setErrorMessage("Network error. Check your connection and try again.");
        setStatus("error");
      }
    }

    initiateCheckout();
  }, [plan]);

  if (status === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm px-4">
        <div className="max-w-sm rounded-2xl border border-red-100 bg-white p-6 text-center shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900">Checkout failed</h2>
          <p className="mt-2 text-sm text-gray-600">{errorMessage}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Try again
            </button>
            <Link
              href="/pricing"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to pricing
            </Link>
          </div>
        </div>
      </div>
    );
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BETA_MODE, CONTROLLED_BETA_PRICING_PLAN, PUBLIC_PRICING_PLANS } from "@/lib/constants";
import { getClientUser } from "@/lib/auth/client-auth";
import { cn } from "@/lib/utils";
import { ProWaitlistForm } from "./ProWaitlistForm";

export function PricingCards({ annualCheckoutAvailable = false }: { annualCheckoutAvailable?: boolean }) {
  const plans = BETA_MODE ? [CONTROLLED_BETA_PRICING_PLAN] : PUBLIC_PRICING_PLANS;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    const user = getClientUser();
    setIsAuthenticated(Boolean(user && user.role === "admin"));
  }, []);

  async function startAnnualProCheckout() {
    setCheckoutError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_annual" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout could not be started");
      window.location.href = data.url;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout could not be started");
      setLoading(false);
    }
  }

  return (
    <div>
      {checkoutError && (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Checkout could not be started</p>
          <p className="mt-1">{checkoutError}</p>
        </div>
      )}
      <div className={cn("grid gap-6", plans.length === 1 ? "mx-auto max-w-md" : "md:grid-cols-2 xl:grid-cols-3")}>
      {plans.map((plan) => (
        <article key={plan.id} className={cn("relative flex flex-col rounded-2xl border border-border bg-white p-6 sm:p-8", plan.id === "pro_annual" && "border-t-2 border-t-foil")}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-ink">{plan.name}</h2>
            {plan.id === "pro_annual" && <span className="text-sm font-medium text-neutral-700">Best for repeat hosts</span>}
          </div>
          <p className="mt-1 min-h-10 text-neutral-600">{plan.description}</p>
          <p className="mt-5 text-ink"><span className="font-display text-5xl">${plan.price}</span><span className="ml-1 text-neutral-600">{plan.period}</span></p>
          <div className="mt-6 grid grid-cols-2 divide-x divide-border border-y border-border py-3 text-center">
            <div><strong className="block font-semibold text-ink">{plan.events}</strong><span className="text-sm text-neutral-600">{/^1(?:\s|$)/.test(plan.events) ? 'event' : 'events'}</span></div>
            <div><strong className="block font-semibold text-ink">{plan.guests}</strong><span className="text-sm text-neutral-600">guests per event</span></div>
          </div>
          <ul className="my-6 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-neutral-700"><Check className="mt-0.5 h-5 w-5 shrink-0 text-sage" aria-hidden="true" />{feature}</li>)}</ul>
          {plan.id === "pro_annual" && !annualCheckoutAvailable ? (
            <ProWaitlistForm planId={plan.id} />
          ) : plan.id === "pro_annual" && isAuthenticated ? (
            <Button onClick={startAnnualProCheckout} disabled={loading} className="w-full">{loading ? "Opening checkout…" : "Choose annual Pro"}</Button>
          ) : (
            <Link
              href={isAuthenticated ? "/dashboard" : plan.id === "controlled_beta" ? "/signup" : `/signup${plan.id === "free" ? "" : `?plan=${plan.id}`}`}
              className={cn(
                "inline-flex min-h-12 w-full items-center justify-center rounded-lg border px-4 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                plan.id === "pro_annual" || plan.id === "controlled_beta" ? "border-ink bg-ink text-white hover:border-wax hover:bg-wax" : "border-ink/20 text-ink hover:border-ink/40"
              )}
            >
              {plan.id === "controlled_beta" ? "Join the free beta" : plan.id === "free" ? "Start free" : plan.id === "pro_annual" ? "Sign up for Pro" : plan.id === "event_pass" ? "Get an Event Pass" : "Create an event"}
            </Link>
          )}
        </article>
      ))}
      </div>
    </div>
  );
}

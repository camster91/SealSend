"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BETA_MODE, CONTROLLED_BETA_PRICING_PLAN, PUBLIC_PRICING_PLANS } from "@/lib/constants";
import { getClientUser } from "@/lib/auth/client-auth";
import { getAnnualProCtaMode } from "@/lib/pricing-cta";
import { cn } from "@/lib/utils";

export function PricingCards({ annualCheckoutAvailable = false }: { annualCheckoutAvailable?: boolean }) {
  const plans = BETA_MODE ? [CONTROLLED_BETA_PRICING_PLAN] : PUBLIC_PRICING_PLANS;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const annualProCtaMode = getAnnualProCtaMode(annualCheckoutAvailable, isAuthenticated);

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
        <article key={plan.id} className={cn("relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm", plan.id === "pro_annual" ? "border-primary-500 shadow-lg" : "border-neutral-200")}>
          {plan.id === "pro_annual" && <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white"><Sparkles className="h-3.5 w-3.5" />Best for repeat hosts</span>}
          <h2 className="font-display text-xl font-bold text-neutral-900">{plan.name}</h2>
          <p className="mt-1 min-h-10 text-sm text-neutral-500">{plan.description}</p>
          <p className="mt-5"><span className="font-display text-4xl font-bold text-neutral-900">${plan.price}</span><span className="text-neutral-500">{plan.period}</span></p>
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-3 text-center">
            <div><strong className="block text-neutral-900">{plan.events}</strong><span className="text-xs text-neutral-500">{plan.events === '1' ? 'event' : 'events'}</span></div>
            <div><strong className="block text-neutral-900">{plan.guests}</strong><span className="text-xs text-neutral-500">guests/event</span></div>
          </div>
          <ul className="my-6 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-neutral-700"><Check className="h-5 w-5 shrink-0 text-primary-600" />{feature}</li>)}</ul>
          {plan.id === "pro_annual" && annualProCtaMode === "waitlist" ? (
            <div className="space-y-2">
              <Link
                href="/signup?plan=pro_annual"
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-brand-600 bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Join Pro waitlist
              </Link>
              <p className="text-center text-xs leading-5 text-neutral-500">
                Pro checkout is not open yet. Join the beta and we&apos;ll keep your Pro plan selected for launch.
              </p>
            </div>
          ) : plan.id === "pro_annual" && annualProCtaMode === "checkout" ? (
            <Button onClick={startAnnualProCheckout} disabled={loading} className="w-full">{loading ? "Opening checkout…" : "Choose annual Pro"}</Button>
          ) : (
            <Link
              href={isAuthenticated ? "/dashboard" : plan.id === "controlled_beta" ? "/signup" : `/signup${plan.id === "free" ? "" : `?plan=${plan.id}`}`}
              className={cn(
                "inline-flex h-10 w-full items-center justify-center rounded-lg border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                plan.id === "pro_annual" ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700" : "border-border hover:bg-neutral-50"
              )}
            >
              {plan.id === "controlled_beta" ? "Join controlled beta" : plan.id === "free" ? "Start free" : plan.id === "pro_annual" ? "Sign up for Pro" : "Create an event"}
            </Link>
          )}
        </article>
      ))}
      </div>
    </div>
  );
}

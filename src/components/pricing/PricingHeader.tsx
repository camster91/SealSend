"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BETA_MODE } from "@/lib/constants";

export function PricingHeader() {
  const [isYearly, setIsYearly] = useState(true);

  if (BETA_MODE) {
    return (
      <section className="px-4 pt-20 pb-12 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent-100 px-4 py-1.5 text-sm font-medium text-accent-700 mb-6">
            <Sparkles className="h-4 w-4" />
            Currently in Beta
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
            Everything is{" "}
            <span className="text-gradient">free</span>{" "}
            during beta
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            We&apos;re building SealSend with our early users. Enjoy all features 
            for free while we refine the experience. Pricing will be announced soon.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 pt-20 pb-12 text-center">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          Simple, transparent{" "}
          <span className="text-gradient">pricing</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
          Start free and upgrade when you need more. No hidden fees, cancel anytime.
        </p>

        {/* Billing Toggle */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              !isYearly ? "text-neutral-900" : "text-neutral-500"
            )}
          >
            Monthly
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className="relative inline-flex h-7 w-14 items-center rounded-full bg-primary-100 transition-colors hover:bg-primary-200"
            aria-label="Toggle yearly billing"
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-primary-600 shadow-lg transition-transform",
                isYearly ? "translate-x-8" : "translate-x-1"
              )}
            />
          </button>
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              isYearly ? "text-neutral-900" : "text-neutral-500"
            )}
          >
            Yearly
          </span>
          <span className="inline-flex items-center rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-medium text-accent-700">
            <Check className="mr-1 h-3 w-3" />
            Save 30%
          </span>
        </div>
      </div>
    </section>
  );
}

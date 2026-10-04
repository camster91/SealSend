"use client";

import Link from "next/link";
import { X, Sparkles, Check, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_TIERS, BETA_MODE } from "@/lib/constants";

interface UpgradePromptProps {
  feature: string;
  className?: string;
  variant?: "modal" | "inline" | "floating";
  onDismiss?: () => void;
}

export function UpgradePrompt({
  feature,
  className,
  variant = "inline",
  onDismiss,
}: UpgradePromptProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (BETA_MODE || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const proTier = SUBSCRIPTION_TIERS.find((t) => t.id === "pro");
  const businessTier = SUBSCRIPTION_TIERS.find((t) => t.id === "business");

  if (variant === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div
          className={cn(
            "relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl",
            className
          )}
        >
          <button
            onClick={handleDismiss}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-50" aria-hidden="true">
              <Sparkles className="h-8 w-8 text-ink" />
            </div>
            <h2 className="mt-6 font-display text-3xl text-ink">
              Unlock {feature}
            </h2>
            <p className="mt-2 text-neutral-600">
              Upgrade to access this feature and more premium capabilities.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {/* Pro Option */}
            <div className="rounded-2xl border-2 border-ink bg-primary-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-primary-900">
                    {proTier?.name}
                  </p>
                  <p className="text-sm text-primary-700">
                    ${proTier?.price.monthly}/month
                  </p>
                </div>
                <Link href="/signup?plan=pro">
                  <Button>
                    Choose Pro
                  </Button>
                </Link>
              </div>
              <ul className="mt-4 space-y-2">
                {proTier?.features.slice(0, 4).map((f) => (
                  <li key={f.name} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary-600" />
                    <span className="text-primary-800">{f.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Business Option */}
            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-neutral-900">
                    {businessTier?.name}
                  </p>
                  <p className="text-sm text-neutral-600">
                    ${businessTier?.price.monthly}/month
                  </p>
                </div>
                <Link href="/signup?plan=business">
                  <Button variant="outline">Choose Business</Button>
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-neutral-600">
            14-day money-back guarantee • Cancel anytime
          </p>
        </div>
      </div>
    );
  }

  if (variant === "floating") {
    return (
      <div
        className={cn(
          "fixed bottom-4 right-4 z-40 max-w-sm rounded-2xl border border-border bg-white p-4 shadow-lg",
          className
        )}
      >
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50" aria-hidden="true">
            <Sparkles className="h-5 w-5 text-ink" />
          </div>
          <div>
            <p className="font-medium text-neutral-900">Unlock {feature}</p>
            <p className="mt-1 text-sm text-neutral-600">
              Upgrade to Pro for ${proTier?.price.monthly}/mo
            </p>
            <Link
              href="/pricing"
              className="mt-2 inline-flex items-center text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              See all features
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Inline variant (default)
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-white p-6",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50" aria-hidden="true">
            <Sparkles className="h-6 w-6 text-ink" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink">
              Unlock {feature}
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Upgrade to Pro for ${proTier?.price.monthly}/month and get access to
              premium features.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/pricing">
            <Button className="btn-lift">
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              Upgrade Now
            </Button>
          </Link>
          {onDismiss && (
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

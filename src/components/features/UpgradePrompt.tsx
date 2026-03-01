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
            className="absolute right-4 top-4 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
              <Sparkles className="h-8 w-8 text-primary-600" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold text-neutral-900">
              Unlock {feature}
            </h2>
            <p className="mt-2 text-neutral-600">
              Upgrade to access this feature and more premium capabilities.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {/* Pro Option */}
            <div className="rounded-xl border-2 border-primary-500 bg-primary-50 p-4">
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
                  <Button className="bg-primary-600 hover:bg-primary-700">
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
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-neutral-900">
                    {businessTier?.name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    ${businessTier?.price.monthly}/month
                  </p>
                </div>
                <Link href="/signup?plan=business">
                  <Button variant="outline">Choose Business</Button>
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-neutral-500">
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
          "fixed bottom-4 right-4 z-40 max-w-sm rounded-xl border border-accent-200 bg-white p-4 shadow-lg",
          className
        )}
      >
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-100">
            <Sparkles className="h-5 w-5 text-accent-600" />
          </div>
          <div>
            <p className="font-medium text-neutral-900">Unlock {feature}</p>
            <p className="mt-1 text-sm text-neutral-600">
              Upgrade to Pro for ${proTier?.price.monthly}/mo
            </p>
            <Link
              href="/pricing"
              className="mt-2 inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
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
        "rounded-xl border border-accent-200 bg-gradient-to-r from-accent-50 to-primary-50 p-6",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-100">
            <Sparkles className="h-6 w-6 text-accent-600" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-neutral-900">
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
            <Button className="btn-lift bg-primary-600 hover:bg-primary-700">
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade Now
            </Button>
          </Link>
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="rounded-full p-2 text-neutral-400 hover:bg-white/50 hover:text-neutral-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

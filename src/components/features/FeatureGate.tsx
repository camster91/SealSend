"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { BETA_MODE, SUBSCRIPTION_TIERS } from "@/lib/constants";

interface FeatureGateProps {
  children: React.ReactNode;
  requiredTier: "free" | "pro" | "business";
  currentTier?: string;
  featureName: string;
  featureDescription?: string;
  className?: string;
  mode?: "overlay" | "hide" | "banner";
}

export function FeatureGate({
  children,
  requiredTier,
  currentTier = "free",
  featureName,
  featureDescription,
  className,
  mode = "overlay",
}: FeatureGateProps) {
  // In beta mode, all features are unlocked
  if (BETA_MODE) {
    return <>{children}</>;
  }

  const tierOrder = ["free", "pro", "business"];
  const requiredIndex = tierOrder.indexOf(requiredTier);
  const currentIndex = tierOrder.indexOf(currentTier);

  const hasAccess = currentIndex >= requiredIndex;

  if (hasAccess) {
    return <>{children}</>;
  }

  // Find the required tier details
  const requiredTierDetails = SUBSCRIPTION_TIERS.find(
    (t) => t.id === requiredTier
  );

  if (mode === "hide") {
    return null;
  }

  if (mode === "banner") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-white p-4",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50" aria-hidden="true">
            <Sparkles className="h-4 w-4 text-ink" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-ink">
              {featureName} is a {requiredTierDetails?.name} feature
            </p>
            {featureDescription && (
              <p className="mt-1 text-sm text-neutral-600">{featureDescription}</p>
            )}
            <Link
              href="/pricing"
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              Upgrade to unlock
              <svg
                aria-hidden="true"
                className="ml-1 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Default overlay mode
  return (
    <div className={cn("relative", className)}>
      {children}
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/90 p-6 backdrop-blur-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50" aria-hidden="true">
          <Lock className="h-6 w-6 text-ink" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-ink">
          {featureName}
        </h3>
        {featureDescription && (
          <p className="mt-1 max-w-xs text-center text-sm text-neutral-600">
            {featureDescription}
          </p>
        )}
        <p className="mt-2 text-sm text-neutral-600">
          Upgrade to {requiredTierDetails?.name} to unlock
        </p>
        <Link href="/pricing" className="mt-4">
          <Button className="btn-lift">
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            Upgrade Now
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface UsageLimitProps {
  current: number;
  limit: number;
  label: string;
  className?: string;
}

export function UsageLimit({ current, limit, label, className }: UsageLimitProps) {
  const percentage = Math.min((current / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600">{label}</span>
        <span
          className={cn(
            "font-medium",
            isAtLimit ? "text-error-700" : "text-ink"
          )}
        >
          {current} / {limit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isAtLimit
              ? "bg-error-500"
              : isNearLimit
              ? "bg-warning-500"
              : "bg-ink"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isNearLimit && !isAtLimit && (
        <p className="text-xs text-neutral-700">
          You&apos;re approaching your limit. Consider upgrading for more.
        </p>
      )}
      {isAtLimit && (
        <p className="text-xs text-error-700">
          You&apos;ve reached your limit. Upgrade to continue.
        </p>
      )}
    </div>
  );
}

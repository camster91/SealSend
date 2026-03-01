"use client";

import Link from "next/link";
import { Check, X, Sparkles, Zap, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_TIERS, BETA_MODE } from "@/lib/constants";

interface PricingCardsProps {
  isYearly?: boolean;
}

const tierIcons = {
  free: Sparkles,
  pro: Zap,
  business: Building2,
};

export function PricingCards({ isYearly = true }: PricingCardsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
      {SUBSCRIPTION_TIERS.map((tier) => {
        const Icon = tierIcons[tier.id as keyof typeof tierIcons];
        const price = BETA_MODE ? 0 : isYearly ? tier.price.yearly : tier.price.monthly;
        const period = isYearly ? "/year" : "/month";

        return (
          <div
            key={tier.id}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300",
              "hover:-translate-y-1 hover:shadow-xl",
              tier.popular
                ? "border-primary-500 shadow-lg lg:scale-105 lg:p-8"
                : "border-neutral-200"
            )}
          >
            {/* Popular Badge */}
            {tier.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-4 py-1 text-sm font-medium text-white shadow-md">
                  <Sparkles className="h-3.5 w-3.5" />
                  Most Popular
                </span>
              </div>
            )}

            {/* Tier Header */}
            <div className="mb-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
                <Icon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="font-display text-xl font-bold text-neutral-900">
                {tier.name}
              </h3>
              <p className="mt-1 text-sm text-neutral-500">{tier.description}</p>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-neutral-900">
                  ${BETA_MODE ? "0" : price}
                </span>
                {!BETA_MODE && (
                  <span className="text-neutral-500">{period}</span>
                )}
              </div>
              {BETA_MODE ? (
                <p className="mt-1 text-sm text-accent-600 font-medium">
                  Free during beta
                </p>
              ) : isYearly && price > 0 ? (
                <p className="mt-1 text-sm text-accent-600 font-medium">
                  Save ${(tier.price.monthly * 12) - tier.price.yearly}/year
                </p>
              ) : null}
            </div>

            {/* CTA Button */}
            <Link href={tier.cta.href} className="mb-6">
              <Button
                className={cn(
                  "w-full btn-lift",
                  tier.popular
                    ? "bg-primary-600 hover:bg-primary-700 text-white"
                    : "bg-neutral-100 hover:bg-neutral-200 text-neutral-900"
                )}
                size="lg"
              >
                {BETA_MODE ? "Get Started Free" : tier.cta.text}
              </Button>
            </Link>

            {/* Features List */}
            <div className="flex-1 space-y-3">
              <p className="text-sm font-medium text-neutral-900">
                What&apos;s included:
              </p>
              <ul className="space-y-3">
                {tier.features.slice(0, 6).map((feature) => (
                  <li key={feature.name} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                    ) : (
                      <X className="mt-0.5 h-5 w-5 shrink-0 text-neutral-300" />
                    )}
                    <span
                      className={cn(
                        "text-sm",
                        feature.included ? "text-neutral-700" : "text-neutral-400"
                      )}
                    >
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Limits Summary */}
            <div className="mt-6 border-t border-neutral-100 pt-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="font-display text-2xl font-bold text-neutral-900">
                    {tier.limits.events === "unlimited" ? "∞" : tier.limits.events}
                  </p>
                  <p className="text-xs text-neutral-500">Events</p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-neutral-900">
                    {tier.limits.guestsPerEvent === "unlimited" ? "∞" : tier.limits.guestsPerEvent}
                  </p>
                  <p className="text-xs text-neutral-500">Guests/Event</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

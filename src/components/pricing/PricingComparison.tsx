"use client";

import { Check, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_TIERS, BETA_MODE } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

export function PricingComparison() {
  // Get all unique feature names
  const allFeatures = SUBSCRIPTION_TIERS[0].features.map((f) => f.name);

  return (
    <section className="bg-white px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold text-neutral-900">
            Compare all features
          </h2>
          <p className="mt-4 text-neutral-600">
            Everything you need to know about our plans
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Table Header */}
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                    Feature
                  </th>
                  {SUBSCRIPTION_TIERS.map((tier) => (
                    <th
                      key={tier.id}
                      className={cn(
                        "px-6 py-4 text-center text-sm font-semibold",
                        tier.popular
                          ? "bg-primary-50 text-primary-900"
                          : "text-neutral-900"
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{tier.name}</span>
                        {BETA_MODE ? (
                          <span className="text-xs font-normal text-accent-600">
                            Free
                          </span>
                        ) : (
                          <span className="text-xs font-normal text-neutral-500">
                            ${tier.price.monthly}/mo
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-neutral-100">
                {allFeatures.map((featureName, idx) => (
                  <tr
                    key={featureName}
                    className={cn(
                      "transition-colors hover:bg-neutral-50",
                      idx % 2 === 0 ? "bg-white" : "bg-neutral-50/50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">
                          {featureName}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-neutral-400 hover:text-neutral-600">
                                <HelpCircle className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">
                                Learn more about {featureName}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                    {SUBSCRIPTION_TIERS.map((tier) => {
                      const feature = tier.features.find(
                        (f) => f.name === featureName
                      );
                      const isIncluded = feature?.included ?? false;

                      return (
                        <td
                          key={`${tier.id}-${featureName}`}
                          className={cn(
                            "px-6 py-4 text-center",
                            tier.popular && "bg-primary-50/30"
                          )}
                        >
                          {isIncluded ? (
                            <div className="flex justify-center">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100">
                                <Check className="h-4 w-4 text-primary-600" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <X className="h-5 w-5 text-neutral-300" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Limits Section */}
                <tr className="border-t-2 border-neutral-200 bg-neutral-100">
                  <td
                    colSpan={SUBSCRIPTION_TIERS.length + 1}
                    className="px-6 py-3 text-sm font-semibold text-neutral-900"
                  >
                    Limits
                  </td>
                </tr>

                {[
                  { label: "Events", key: "events" as const },
                  { label: "Guests per event", key: "guestsPerEvent" as const },
                  { label: "Total responses", key: "responses" as const },
                  { label: "Team members", key: "teamMembers" as const },
                  { label: "Storage", key: "storageGB" as const },
                ].map(({ label, key }) => (
                  <tr key={key} className="transition-colors hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                      {label}
                    </td>
                    {SUBSCRIPTION_TIERS.map((tier) => {
                      const limit = tier.limits[key];
                      const displayValue =
                        limit === "unlimited"
                          ? "Unlimited"
                          : key === "storageGB"
                          ? `${limit} GB`
                          : limit.toLocaleString();

                      return (
                        <td
                          key={`${tier.id}-${key}`}
                          className={cn(
                            "px-6 py-4 text-center text-sm",
                            tier.popular && "bg-primary-50/30 font-medium text-primary-900"
                          )}
                        >
                          {displayValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View Notice */}
        <p className="mt-4 text-center text-sm text-neutral-500 lg:hidden">
          Scroll horizontally to see all features
        </p>
      </div>
    </section>
  );
}

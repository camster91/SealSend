import type { Metadata } from "next";
import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingCards } from "@/components/pricing/PricingCards";
import { PricingComparison } from "@/components/pricing/PricingComparison";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import { PricingCTA } from "@/components/pricing/PricingCTA";

export const metadata: Metadata = {
  title: "Pricing - SealSend",
  description: "Simple, transparent pricing for digital invitations. Start free, upgrade when you need more.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/50 via-white to-white">
      {/* Header Section */}
      <PricingHeader />

      {/* Pricing Cards */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-7xl">
          <PricingCards />
        </div>
      </section>

      {/* Comparison Table */}
      <PricingComparison />

      {/* FAQ Section */}
      <PricingFAQ />

      {/* CTA Section */}
      <PricingCTA />
    </div>
  );
}

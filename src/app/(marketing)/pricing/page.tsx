import type { Metadata } from "next";
import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingCards } from "@/components/pricing/PricingCards";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import { PricingCTA } from "@/components/pricing/PricingCTA";
import { isAnnualProCheckoutAvailable } from '@/lib/billing';
import { BETA_MODE } from '@/lib/constants';

export const metadata: Metadata = {
  title: "Pricing - SealSend",
  description: "Run one complete event for up to 100 guests in SealSend's controlled beta.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/50 via-white to-white">
      {/* Header Section */}
      <PricingHeader />

      {/* Pricing Cards */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-7xl">
          <PricingCards annualCheckoutAvailable={isAnnualProCheckoutAvailable()} />
          <p className="mt-5 text-center text-sm text-neutral-500">
            {BETA_MODE ? "The controlled beta is free and paid checkout remains disabled." : "All prices are in USD. Applicable taxes are calculated at checkout."}
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <PricingFAQ />

      {/* CTA Section */}
      <PricingCTA />
    </div>
  );
}

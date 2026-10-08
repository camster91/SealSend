import type { Metadata } from "next";
import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingCards } from "@/components/pricing/PricingCards";
import { PRICING_FAQS, PricingFAQ } from "@/components/pricing/PricingFAQ";
import { PricingCTA } from "@/components/pricing/PricingCTA";
import { JsonLd } from "@/components/marketing/JsonLd";
import { faqJsonLd } from "@/components/marketing/FaqList";
import { isAnnualProCheckoutAvailable } from '@/lib/billing';
import { BETA_MODE } from '@/lib/constants';
import { OG_IMAGE } from '@/lib/metadata';
import { softwareApplicationJsonLd } from '@/lib/structured-data';

const title = BETA_MODE ? 'Free beta: one complete event' : "Pricing: Free, Event Pass and Pro";
const description = BETA_MODE
  ? "SealSend is free during the beta: one active event with up to 100 guests. One flat price per event after the beta, never per guest."
  : "Start free for one event, add an Event Pass for up to 250 guests, or choose annual Pro. One flat price per event, never per guest.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title, description, url: "/pricing", images: [OG_IMAGE] },
};

export default function PricingPage() {
  return (
    <div>
      <JsonLd data={[softwareApplicationJsonLd(), faqJsonLd(PRICING_FAQS)]} />
      {/* Header Section */}
      <PricingHeader />

      {/* Pricing Cards */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <PricingCards annualCheckoutAvailable={isAnnualProCheckoutAvailable()} />
          <p className="mt-6 text-center text-sm text-neutral-600">
            {BETA_MODE ? "Paid checkout is turned off during the beta." : "All prices are in USD. Applicable taxes are calculated at checkout."}
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

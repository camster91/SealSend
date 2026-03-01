import { createMetadata, SITE_URL } from "@/lib/metadata";
import { JsonLd } from "@/components/marketing/JsonLd";
import PricingCards from "@/components/marketing/PricingCards";
import PricingFAQ from "@/components/marketing/PricingFAQ";
import FeaturesGrid from "@/components/marketing/FeaturesGrid";
import Testimonials from "@/components/marketing/Testimonials";

export const metadata = createMetadata({
  title: "Pricing — Simple Pay-Per-Event Plans",
  description:
    "Simple, transparent pricing for every event size. Start free with 15 guest replies. Upgrade to Standard ($5) or Premium ($10) per event when you need more.",
  path: "/pricing",
  keywords: [
    "invitation pricing",
    "digital invitation cost",
    "free digital invitations",
    "event invitation pricing",
    "RSVP pricing plans",
  ],
});

export default function PricingPage() {
  const pricingJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Seal and Send Free",
      description:
        "Everything you need to create and send invites — free forever. 15 guest replies per event.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/pricing`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Seal and Send Standard",
      description:
        "50 guest replies, SMS invites, guest tags, branding removal — $5 per event.",
      offers: {
        "@type": "Offer",
        price: "5.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/pricing`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Seal and Send Premium",
      description:
        "Unlimited replies, sign-up board, priority support — $10 per event.",
      offers: {
        "@type": "Offer",
        price: "10.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/pricing`,
      },
    },
  ];

  return (
    <>
      <JsonLd data={pricingJsonLd} />

      <main>
        {/* Hero header */}
        <section className="gradient-brand px-4 py-20 text-center text-white">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
              Beta &mdash; Everything Free
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Free While We&apos;re in Beta
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
              All premium features are completely free during our beta period.
              No credit card needed. No hidden fees. Just create and send.
            </p>
          </div>
        </section>

        {/* Pricing tiers */}
        <PricingCards />

        {/* Features */}
        <FeaturesGrid />

        {/* Testimonials */}
        <Testimonials />

        {/* FAQ */}
        <PricingFAQ />
      </main>
    </>
  );
}

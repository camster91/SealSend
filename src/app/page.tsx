import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import Hero from "@/components/marketing/Hero";
import TrustBar from "@/components/marketing/TrustBar";
import HowItWorks from "@/components/marketing/HowItWorks";
import UseCaseHighlights from "@/components/marketing/UseCaseHighlights";
import FeaturesGrid from "@/components/marketing/FeaturesGrid";
import Testimonials from "@/components/marketing/Testimonials";
import PricingCards from "@/components/marketing/PricingCards";
import PricingFAQ from "@/components/marketing/PricingFAQ";
import CTASection from "@/components/marketing/CTASection";
import { JsonLd } from "@/components/marketing/JsonLd";
import { createMetadata, SITE_URL, SITE_NAME } from "@/lib/metadata";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const metadata = createMetadata({
  title: "Seal and Send — Beautiful Digital Invitations & RSVP Management",
  path: "",
  keywords: [
    "digital invitations",
    "invitation",
    "online invitations",
    "RSVP management",
    "free digital invitations",
  ],
});

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Also check for custom session cookie
  const cookieStore = await cookies();
  const hasCustomSession = !!cookieStore.get("sealsend_session")?.value;
  const isAuthenticated = !!user || hasCustomSession;

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL,
            logo: `${SITE_URL}/icons/icon.svg`,
            description:
              "Create beautiful digital invitations, collect RSVPs instantly, and manage your event — all in one place.",
          },
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: SITE_NAME,
            url: SITE_URL,
            applicationCategory: "LifestyleApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
          },
        ]}
      />

      <Navbar user={isAuthenticated ? (user || {} as any) : null} />

      <main>
        <Hero />
        <TrustBar />
        <HowItWorks />
        <UseCaseHighlights />
        <FeaturesGrid />
        <Testimonials />

        {/* Pricing preview */}
        <section className="bg-neutral-50 py-20">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Start free. Upgrade when your event grows.
            </p>
          </div>
          <PricingCards />
        </section>

        <PricingFAQ />
        <CTASection />
      </main>

      <Footer />
    </>
  );
}

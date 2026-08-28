import type { Metadata } from "next";
import Hero from "@/components/marketing/Hero";
import FeaturesGrid from "@/components/marketing/FeaturesGrid";
import HowItWorks from "@/components/marketing/HowItWorks";
import OrganizerFit from "@/components/marketing/OrganizerFit";
import CTASection from "@/components/marketing/CTASection";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturesGrid />
      <HowItWorks />
      <OrganizerFit />
      <CTASection />
    </>
  );
}

import type { Metadata } from "next";
import Hero from "@/components/marketing/Hero";
import FactStrip from "@/components/marketing/FactStrip";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeatureRows from "@/components/marketing/FeatureRows";
import UseCaseGrid from "@/components/marketing/UseCaseGrid";
import OrganizersSection from "@/components/marketing/OrganizersSection";
import PricingTeaser from "@/components/marketing/PricingTeaser";
import FaqList, { faqJsonLd, type Faq } from "@/components/marketing/FaqList";
import CTASection from "@/components/marketing/CTASection";
import { JsonLd } from "@/components/marketing/JsonLd";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "@/lib/metadata";
import { softwareApplicationJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: { absolute: DEFAULT_TITLE },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: "/" },
};

const homeFaqs: Faq[] = [
  {
    question: "Do my guests need to download anything?",
    answer: "No. They open a link and reply in seconds.",
  },
  {
    question: "Can I import my guest list?",
    answer: "Yes. Upload a CSV with names, emails and phone numbers, or add guests one at a time.",
  },
  {
    question: "How do text messages work?",
    answer: "Every Event Pass includes 500 SMS segments, and you can buy top-ups. Email is always included.",
  },
  {
    question: "Can I export or delete my data?",
    answer: "Yes. You can export your guest list any time and delete your account and events from settings.",
  },
  {
    question: "What happens after the beta?",
    answer: "Your beta event stays free. Paid plans open when the beta ends, and you'll get notice first.",
  },
];

export default function Home() {
  return (
    <>
      <JsonLd data={[softwareApplicationJsonLd(), faqJsonLd(homeFaqs)]} />
      <Hero />
      <FactStrip />
      <HowItWorks />
      <FeatureRows />
      <UseCaseGrid />
      <OrganizersSection />
      <PricingTeaser />
      <FaqList faqs={homeFaqs} />
      <CTASection />
    </>
  );
}

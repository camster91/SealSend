import type { Metadata } from "next";
import InvitationPlayground from "@/components/marketing/InvitationPlayground";
import Hero from "@/components/marketing/Hero";
import HowItWorks from "@/components/marketing/HowItWorks";
import UseCaseGrid from "@/components/marketing/UseCaseGrid";
import PricingTeaser from "@/components/marketing/PricingTeaser";
import FaqList, { faqJsonLd, type Faq } from "@/components/marketing/FaqList";
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
    answer: "No. They open a link and reply, with no account or app.",
  },
  {
    question: "How do I send the invitation?",
    answer: "Share your event link wherever you already talk: a group chat, a message or your own email. SealSend doesn't send text messages or emails to guests for you yet.",
  },
  {
    question: "What about my second event?",
    answer: "You can have one active event at a time. When it's over, archive it and start the next one for free.",
  },
  {
    question: "Can I export or delete my data?",
    answer: "Yes. Export your guest list any time, or delete your account and events from settings.",
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
      <InvitationPlayground />
      <HowItWorks />
      <UseCaseGrid />
      <PricingTeaser />
      <FaqList faqs={homeFaqs} />
    </>
  );
}

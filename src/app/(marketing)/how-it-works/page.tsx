import { createMetadata, SITE_URL, SITE_NAME } from "@/lib/metadata";
import { JsonLd } from "@/components/marketing/JsonLd";
import HowItWorks, { HOW_IT_WORKS_STEPS } from "@/components/marketing/HowItWorks";
import FeatureRows from "@/components/marketing/FeatureRows";
import CTASection from "@/components/marketing/CTASection";
import { PRIMARY_CTA_NOTE, PrimaryCta } from "@/components/marketing/Cta";

export const metadata = createMetadata({
  title: "How SealSend Works: Invitations, RSVPs and Check-in",
  description:
    "Describe your event, send the invitation by email or link, then watch replies arrive and check guests in at the door with a QR scan.",
  path: "/how-it-works",
  keywords: [
    "online invitations with RSVP",
    "how to send digital invitations",
    "RSVP tracking",
    "event check-in app",
  ],
});

export default function HowItWorksPage() {
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to send an invitation and track RSVPs with SealSend",
    description: "Send an online invitation, track every reply, and check guests in at the door in three steps.",
    step: HOW_IT_WORKS_STEPS.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title.replace(/\.$/, ""),
      text: step.text,
    })),
    tool: {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <>
      <JsonLd data={howToJsonLd} />

      <section className="px-4 pb-4 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="max-w-3xl font-display text-5xl text-ink sm:text-6xl">
            From the first invitation to the last guest through the door.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-700">
            Three steps, one link, and nothing for your guests to install.
          </p>
          <PrimaryCta className="mt-8" />
          <p className="mt-4 text-sm text-neutral-600">{PRIMARY_CTA_NOTE}</p>
        </div>
      </section>

      <HowItWorks title="Three steps" />
      <FeatureRows />
      <CTASection />
    </>
  );
}

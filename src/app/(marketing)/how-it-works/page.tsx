import { createMetadata, SITE_URL, SITE_NAME } from "@/lib/metadata";
import { JsonLd } from "@/components/marketing/JsonLd";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeaturesGrid from "@/components/marketing/FeaturesGrid";
import CTASection from "@/components/marketing/CTASection";

export const metadata = createMetadata({
  title: "How Seal and Send Works — Create Digital Invitations in 3 Steps",
  description:
    "Learn how to create beautiful digital invitations in three simple steps: design your invitation, add your guests, and track RSVPs in real-time.",
  path: "/how-it-works",
  keywords: [
    "how to create digital invitations",
    "digital invitation steps",
    "online invitation tutorial",
    "invitation creation guide",
  ],
});

export default function HowItWorksPage() {
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Create Digital Invitations with Seal and Send",
    description:
      "Create and send beautiful digital invitations in three simple steps.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Design Your Invitation",
        text: "Upload your own design or start from scratch. Customize colors, add music, and make it uniquely yours.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Add Your Guests",
        text: "Share via email, text, or a custom link. Your guests get a beautiful, interactive invitation.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Track RSVPs",
        text: "Watch responses roll in. See headcounts, meal choices, and manage everything from your dashboard.",
      },
    ],
    tool: {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <>
      <JsonLd data={howToJsonLd} />

      {/* Hero */}
      <section className="gradient-brand px-4 py-20 text-center text-white sm:py-28">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Create Digital Invitations in 3 Simple Steps
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
            Seal and Send makes it easy to design, share, and manage beautiful
            digital invitations — no design skills required.
          </p>
        </div>
      </section>

      <HowItWorks />
      <FeaturesGrid />
      <CTASection />
    </>
  );
}

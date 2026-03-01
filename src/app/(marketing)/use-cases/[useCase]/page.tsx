import { notFound } from "next/navigation";
import { USE_CASES, USE_CASE_SLUGS } from "@/lib/use-case-content";
import { createMetadata, SITE_URL } from "@/lib/metadata";
import { JsonLd } from "@/components/marketing/JsonLd";
import UseCaseHero from "@/components/marketing/UseCaseHero";
import UseCaseBenefits from "@/components/marketing/UseCaseBenefits";
import UseCaseTestimonial from "@/components/marketing/UseCaseTestimonial";
import { PricingCards } from "@/components/pricing/PricingCards";
import UseCaseFAQ from "@/components/marketing/UseCaseFAQ";
import CTASection from "@/components/marketing/CTASection";

export function generateStaticParams() {
  return USE_CASE_SLUGS.map((slug) => ({ useCase: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ useCase: string }>;
}) {
  const { useCase } = await params;
  const data = USE_CASES[useCase];
  if (!data) return {};

  return createMetadata({
    title: data.metaTitle,
    description: data.metaDescription,
    path: `/use-cases/${data.slug}`,
    keywords: data.keywords,
  });
}

export default async function UseCasePage({
  params,
}: {
  params: Promise<{ useCase: string }>;
}) {
  const { useCase } = await params;
  const data = USE_CASES[useCase];
  if (!data) notFound();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <UseCaseHero
        headline={data.heroHeadline}
        subtext={data.heroSubtext}
        ctaText={data.ctaText}
      />
      <UseCaseBenefits benefits={data.benefits} />
      <UseCaseTestimonial
        quote={data.testimonial.quote}
        name={data.testimonial.name}
        role={data.testimonial.role}
      />

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

      <UseCaseFAQ faqs={data.faqs} />
      <CTASection />
    </>
  );
}

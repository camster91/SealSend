import { notFound, redirect } from "next/navigation";
import { LEGACY_USE_CASE_REDIRECTS, USE_CASES, USE_CASE_SLUGS } from "@/lib/use-case-content";
import { createMetadata } from "@/lib/metadata";
import { JsonLd } from "@/components/marketing/JsonLd";
import UseCaseHero from "@/components/marketing/UseCaseHero";
import UseCaseBenefits from "@/components/marketing/UseCaseBenefits";
import { PricingCards } from "@/components/pricing/PricingCards";
import UseCaseFAQ from "@/components/marketing/UseCaseFAQ";
import CTASection from "@/components/marketing/CTASection";

export function generateStaticParams() {
  return USE_CASE_SLUGS.map((slug) => ({ useCase: slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ useCase: string }>;
}) {
  const { useCase } = await params;
  const canonicalUseCase = LEGACY_USE_CASE_REDIRECTS[useCase] ?? useCase;
  const data = USE_CASES[canonicalUseCase];
  if (!data) notFound();

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
  const canonicalUseCase = LEGACY_USE_CASE_REDIRECTS[useCase] ?? useCase;
  if (canonicalUseCase !== useCase) redirect(`/use-cases/${canonicalUseCase}`);
  const data = USE_CASES[canonicalUseCase];
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
      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One bounded controlled beta
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Run one active event with up to 100 guests. Paid checkout remains disabled while mandatory launch evidence is incomplete.
          </p>
        </div>
        <PricingCards />
      </section>

      <UseCaseFAQ faqs={data.faqs} />
      <CTASection />
    </>
  );
}

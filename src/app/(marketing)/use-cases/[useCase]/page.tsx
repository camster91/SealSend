import { notFound, redirect } from "next/navigation";
import { LEGACY_USE_CASE_REDIRECTS, USE_CASES, USE_CASE_SLUGS } from "@/lib/use-case-content";
import { BETA_MODE } from "@/lib/constants";
import { createMetadata } from "@/lib/metadata";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/marketing/JsonLd";
import { faqJsonLd } from "@/components/marketing/FaqList";
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

  return (
    <>
      <JsonLd
        data={[
          faqJsonLd(data.faqs),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Use cases", path: "/use-cases" },
            { name: data.name, path: `/use-cases/${data.slug}` },
          ]),
        ]}
      />
      <UseCaseHero
        name={data.name}
        headline={data.heroHeadline}
        subtext={data.heroSubtext}
        ctaText={data.ctaText}
        image={data.image}
        imageAlt={data.imageAlt}
      />
      <UseCaseBenefits benefits={data.benefits} />
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl text-ink sm:text-5xl">
            {BETA_MODE ? "Free during the beta" : "One flat price per event, never per guest."}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-700">
            {BETA_MODE
              ? "Run one active event with up to 100 guests. Paid checkout remains disabled while mandatory launch evidence is incomplete."
              : "Start free, add an Event Pass for a bigger event, or choose Pro if you host all year."}
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-7xl">
          <PricingCards />
        </div>
      </section>

      <UseCaseFAQ faqs={data.faqs} />
      <CTASection />
    </>
  );
}

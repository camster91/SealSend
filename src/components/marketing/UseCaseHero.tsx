import Image from "next/image";
import Link from "next/link";
import { PRIMARY_CTA_NOTE, PrimaryCta, SecondaryCta } from "@/components/marketing/Cta";

interface UseCaseHeroProps {
  name: string;
  headline: string;
  subtext: string;
  ctaText: string;
  image: string;
  imageAlt: string;
}

export default function UseCaseHero({ name, headline, subtext, ctaText, image, imageAlt }: UseCaseHeroProps) {
  return (
    <section className="bg-[#faf7f0] px-4 pb-16 pt-10 sm:px-6 sm:pb-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              <li>
                <Link href="/use-cases" className="rounded underline-offset-4 hover:text-ink hover:underline">
                  Use cases
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-ink">
                {name}
              </li>
            </ol>
          </nav>
          <h1 className="mt-8 font-display text-[2.6rem] text-ink sm:text-6xl">{headline}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-700">{subtext}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryCta label={ctaText} />
            <SecondaryCta href="/pricing">See pricing</SecondaryCta>
          </div>
          <p className="mt-4 text-sm text-neutral-600">{PRIMARY_CTA_NOTE}</p>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-border lg:col-span-6 lg:max-h-[38rem]">
          <Image src={image} alt={imageAlt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
      </div>
    </section>
  );
}

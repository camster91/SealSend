import Image from "next/image";
import { PRIMARY_CTA_NOTE, PrimaryCta } from "@/components/marketing/Cta";

export default function CTASection() {
  return (
    <section className="bg-[#e5daf4] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-[1fr_2fr]">
        <Image src="/brand/illustrations/seal-sidekick.webp" alt="A friendly seal carrying a yellow invitation" width={600} height={600} sizes="(min-width: 768px) 280px, 220px" className="mx-auto h-auto w-44 rounded-full sm:w-56" />
        <div className="text-center md:text-left">
          <h2 className="font-display text-4xl text-ink sm:text-5xl">Your next event, sealed and sent.</h2>
          <p className="mt-4 text-lg text-neutral-700">You bring the people. We&apos;ll help with the details.</p>
          <PrimaryCta className="mt-7" />
          <p className="mt-4 text-sm text-neutral-600">{PRIMARY_CTA_NOTE}</p>
        </div>
      </div>
    </section>
  );
}

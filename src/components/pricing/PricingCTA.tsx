import { BETA_MODE } from "@/lib/constants";
import Image from "next/image";
import { PrimaryCta, SecondaryCta } from "@/components/marketing/Cta";

export function PricingCTA() {
  return (
    <section className="bg-[#e5daf4] px-4 py-20 text-ink sm:px-6 sm:py-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Image src="/brand/illustrations/seal-digital.webp" alt="" width={600} height={600} sizes="160px" className="h-40 w-40 rounded-full" />
        <h2 className="mt-6 font-display text-4xl sm:text-5xl">
          {BETA_MODE ? "Ready to run one real event?" : "Your next event, sealed and sent."}
        </h2>
        <p className="mt-4 max-w-xl text-lg text-neutral-700">
          {BETA_MODE
            ? "Free during the beta for one active event with up to 100 guests. No credit card required."
            : "Free for your first event. No credit card required."}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <PrimaryCta />
          <SecondaryCta href="/how-it-works">
            See how it works
          </SecondaryCta>
        </div>
      </div>
    </section>
  );
}

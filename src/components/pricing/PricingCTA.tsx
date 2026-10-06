import { BETA_MODE } from "@/lib/constants";
import { SealMark } from "@/components/layout/Logo";
import { PrimaryCta, SecondaryCta } from "@/components/marketing/Cta";

export function PricingCTA() {
  return (
    <section className="bg-ink px-4 py-20 text-white sm:px-6 sm:py-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <SealMark className="h-12 w-12" />
        <h2 className="mt-6 font-display text-4xl sm:text-5xl">
          {BETA_MODE ? "Ready to run one real event?" : "Your next event, sealed and sent."}
        </h2>
        <p className="mt-4 max-w-xl text-lg text-white/80">
          {BETA_MODE
            ? "Free during the free beta for one active event with up to 100 guests. No credit card required."
            : "Free for your first event. No credit card required."}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <PrimaryCta onInk />
          <SecondaryCta href="/how-it-works" onInk>
            See how it works
          </SecondaryCta>
        </div>
      </div>
    </section>
  );
}

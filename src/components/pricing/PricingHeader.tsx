import { BETA_MODE } from "@/lib/constants";
import { PrimaryCta } from "@/components/marketing/Cta";

export function PricingHeader() {
  return (
    <section className="px-4 pb-8 pt-10 text-center sm:px-6 sm:pb-12 sm:pt-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl text-ink sm:text-6xl">
          {BETA_MODE ? "Run one complete event, free, during the beta." : "Pay for one event, or host all year."}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-700">
          {BETA_MODE
            ? "Create your invitation, collect replies and check guests in. One complete event, free."
            : "One flat price per event, never per guest. Start free, add an Event Pass for a bigger event, or choose Pro if you host all year."}
        </p>
        {BETA_MODE && <PrimaryCta className="mt-6" />}
        <p className="mt-3 text-sm font-medium text-neutral-600">
          {BETA_MODE ? "One active event, up to 100 guests, and no payment card required." : "All prices are in USD. Applicable taxes are shown at checkout."}
        </p>
      </div>
    </section>
  );
}

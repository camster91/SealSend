import { BETA_MODE } from "@/lib/constants";

export function PricingHeader() {
  return (
    <section className="px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-5xl text-ink sm:text-6xl">
          {BETA_MODE ? "Run one complete event, free, during the beta." : "Pay for one event, or host all year."}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-700">
          {BETA_MODE
            ? "Built for planners, recurring organizers and hosts who want to run a real invitation, RSVP, guest list, update and check-in from start to finish."
            : "One flat price per event, never per guest. Start free, add an Event Pass for a bigger event, or choose Pro if you host all year."}
        </p>
        <p className="mt-3 text-sm font-medium text-neutral-600">
          {BETA_MODE ? "One active event, up to 100 guests, and no payment card required." : "All prices are in USD. Applicable taxes are shown at checkout."}
        </p>
      </div>
    </section>
  );
}

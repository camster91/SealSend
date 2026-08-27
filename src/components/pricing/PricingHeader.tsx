import { BETA_MODE } from "@/lib/constants";

export function PricingHeader() {
  return (
    <section className="px-4 pt-20 pb-12 text-center">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          {BETA_MODE ? (
            <>Run one complete event in the <span className="text-gradient">controlled beta</span></>
          ) : (
            <>Pay for one event, <span className="text-gradient">or host all year</span></>
          )}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
          {BETA_MODE
            ? "Built for recurring community organizers and independent planners who can test a real invitation, RSVP, guest-management, communications, and check-in workflow."
            : "Built for independent planners, community organizers, and small teams. Start free with the complete event workflow; upgrade one event for capacity or choose annual Pro for recurring work."}
        </p>
        <p className="mt-3 text-sm font-medium text-neutral-500">
          {BETA_MODE ? "One active event, up to 100 guests, and no payment card required." : "All prices are in USD. Applicable taxes are shown at checkout."}
        </p>
      </div>
    </section>
  );
}

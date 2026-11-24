import Link from "next/link";
import { BETA_MODE, PUBLIC_PRICING_PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PrimaryCta, SecondaryCta } from "./Cta";

const periodLabel: Record<string, string> = { "/event": "per event", "/year": "per year" };

// Prices come straight from PUBLIC_PRICING_PLANS so the home page can never drift from /pricing.
export default function PricingTeaser() {
  if (BETA_MODE) {
    return (
      <section aria-labelledby="pricing-teaser-title" className="border-y border-border bg-white px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-ink">Free during the beta</p>
            <h2 id="pricing-teaser-title" className="mt-4 font-display text-4xl text-ink sm:text-5xl">One event at a time, up to 100 guests.</h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-700">No payment card needed. When your event is over, archive it and start the next one.</p>
            <div className="mt-7 flex flex-wrap gap-3"><PrimaryCta /><SecondaryCta href="/pricing">What&apos;s included?</SecondaryCta></div>
            <p className="mt-4 text-sm text-neutral-600">Paid checkout is disabled during the beta.</p>
          </div>
          <ul className="self-center space-y-4 rounded-2xl bg-cotton p-6 text-ink sm:p-8">
            {[
              "An invitation with its own link",
              "Replies, plus-ones and allergies in one list",
              "Check-in at the door from your phone",
            ].map(item => <li key={item} className="flex gap-3"><span aria-hidden="true" className="font-semibold">✓</span><span>{item}</span></li>)}
          </ul>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="pricing-teaser-title" className="border-y border-border bg-white px-4 py-12 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <h2 id="pricing-teaser-title" className="font-display text-4xl text-ink sm:text-5xl">
            One flat price per event, never per guest.
          </h2>
        </div>
        <ul className="mt-8 grid gap-4 sm:mt-12 sm:gap-6 md:grid-cols-3">
          {PUBLIC_PRICING_PLANS.map((plan) => {
            const recommended = plan.id === "pro_annual";
            return (
              <li
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl border border-border bg-cotton/60 p-5 sm:p-6",
                  recommended && "border-t-2 border-t-foil bg-white",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
                  {recommended && <span className="text-sm font-medium text-neutral-700">Recommended</span>}
                </div>
                <p className="mt-3 text-ink sm:mt-4">
                  <span className="font-display text-4xl sm:text-5xl">${plan.price}</span>
                  {plan.period && <span className="ml-2 text-neutral-600">{periodLabel[plan.period] ?? plan.period}</span>}
                </p>
                <p className="mt-3 text-neutral-600">{plan.description}</p>
                <p className="mt-4 text-sm font-medium text-ink">
                  {plan.events === "1" ? "1 event" : `${plan.events} events`}, up to {plan.guests} guests each
                </p>
              </li>
            );
          })}
        </ul>
        <Link href="/pricing" className="mt-8 inline-flex min-h-11 items-center text-base font-semibold text-ink underline underline-offset-4 hover:text-wax">
          {BETA_MODE ? 'See the free beta' : 'Compare plans'}
        </Link>
      </div>
    </section>
  );
}

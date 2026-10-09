import { BETA_MODE, PUBLIC_PRICING_PLANS } from "@/lib/constants";

const eventPassGuests = PUBLIC_PRICING_PLANS.find((plan) => plan.id === "event_pass")?.guests ?? "250";

// Plain product facts, not social proof.
const facts = [
  BETA_MODE ? "Free beta: up to 100 guests" : `Up to ${eventPassGuests} guests per Event Pass`,
  "Email updates",
  "QR check-in from any phone",
  "Guests never need an account",
];

export default function FactStrip() {
  return (
    <section aria-label="SealSend at a glance" className="border-y border-border bg-white">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <li
            key={fact}
            className="border-border px-3 py-4 text-center text-sm sm:px-6 sm:py-6 sm:text-[0.95rem] font-medium text-ink odd:border-r lg:border-r lg:last:border-r-0 [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0"
          >
            {fact}
          </li>
        ))}
      </ul>
    </section>
  );
}

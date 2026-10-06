import Link from "next/link";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Support and Response Expectations - SealSend",
  description: "How to contact SealSend support, what response time to expect, and how to keep account and guest information safe.",
  path: "/support",
});

const priorities = [
  "Security concerns or suspected account compromise",
  "Loss of access to an active event",
  "Billing or subscription incidents",
];

export default function SupportPage() {
  return (
    <div>
      <section className="px-4 pb-8 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="font-display text-5xl text-ink sm:text-6xl">Clear help, clear expectations.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-700">
            Email <a className="font-semibold text-ink underline underline-offset-4" href="mailto:support@sealsend.app">support@sealsend.app</a>. Our target initial response is within two business days.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 pb-24 pt-8 sm:px-6 md:grid-cols-2 lg:px-0">
        <article className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">How requests are prioritized</h2>
          <p className="mt-3 text-neutral-600">The two-business-day target is not a 24/7 or guaranteed resolution time. We triage these categories first:</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-neutral-700">
            {priorities.map((priority) => <li key={priority}>{priority}</li>)}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">What to include</h2>
          <p className="mt-3 text-neutral-600">Share the account email, the affected workflow, when the issue occurred, and the result you expected. Redact screenshots before attaching them.</p>
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-950">
            Never email passwords, one-time codes, session cookies, payment-card data, invitation tokens, or guest-list exports.
          </p>
        </article>

        <article className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">Account data</h2>
          <p className="mt-3 text-neutral-600">Signed-in hosts can download a portable JSON export or schedule account deletion from Settings. Active paid subscriptions must be resolved before deletion can run.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
            <Link className="text-ink underline underline-offset-4" href="/privacy">Privacy policy</Link>
            <Link className="text-ink underline underline-offset-4" href="/terms">Terms of service</Link>
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">Where things stand</h2>
          <p className="mt-3 text-neutral-600">SealSend is a free beta. Email invitations and reminders work. SMS (text messages) and payments are turned off for now.</p>
          <p className="mt-4 text-sm text-neutral-500">Support contact does not itself authorize a charge, refund, external send, account change, or production release.</p>
        </article>
      </section>
    </div>
  );
}

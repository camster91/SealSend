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
    <div className="bg-white">
      <section className="gradient-brand px-4 py-20 text-center text-white sm:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">Support</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Clear Help, Clear Expectations</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
            Email <a className="font-semibold underline underline-offset-4" href="mailto:support@sealsend.app">support@sealsend.app</a>. Our target initial response is within two business days.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-16 md:grid-cols-2">
        <article className="rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">How requests are prioritized</h2>
          <p className="mt-3 text-neutral-600">The two-business-day target is not a 24/7 or guaranteed resolution time. We triage these categories first:</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-neutral-700">
            {priorities.map((priority) => <li key={priority}>{priority}</li>)}
          </ul>
        </article>

        <article className="rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">What to include</h2>
          <p className="mt-3 text-neutral-600">Share the account email, the affected workflow, when the issue occurred, and the result you expected. Redact screenshots before attaching them.</p>
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-950">
            Never email passwords, one-time codes, session cookies, payment-card data, invitation tokens, or guest-list exports.
          </p>
        </article>

        <article className="rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">Account data</h2>
          <p className="mt-3 text-neutral-600">Signed-in hosts can download a portable JSON export or schedule account deletion from Settings. Active paid subscriptions must be resolved before deletion can run.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
            <Link className="text-brand-700 underline underline-offset-4" href="/privacy">Privacy policy</Link>
            <Link className="text-brand-700 underline underline-offset-4" href="/terms">Terms of service</Link>
          </div>
        </article>

        <article className="rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">Controlled-beta boundary</h2>
          <p className="mt-3 text-neutral-600">SealSend is operating a controlled beta. Provider-dependent payments and external communications remain limited until their separate test, compliance, and approval gates pass.</p>
          <p className="mt-4 text-sm text-neutral-500">Support contact does not itself authorize a charge, refund, external send, account change, or production release.</p>
        </article>
      </section>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, Building2, Mail, MessagesSquare, type LucideIcon } from "lucide-react";

const alternatives: Array<{
  icon: LucideIcon;
  name: string;
  usefulWhen: string;
  sealSendFit: string;
}> = [
  {
    icon: MessagesSquare,
    name: "Spreadsheets and group chats",
    usefulWhen: "The event is small and one person can reconcile every change manually.",
    sealSendFit: "Use SealSend when invitation details, replies, plus-ones, updates, and check-in need one event record.",
  },
  {
    icon: Mail,
    name: "Invitation-first tools",
    usefulWhen: "Invitation design and a basic response count are the main job.",
    sealSendFit: "Use SealSend when the guest list must remain actionable after the invitation is opened.",
  },
  {
    icon: Building2,
    name: "Enterprise event platforms",
    usefulWhen: "Ticketing, sponsors, venues, CRM integrations, or multi-event programs justify a larger system.",
    sealSendFit: "Use SealSend for a focused small-team workflow from an approved event brief through check-in.",
  },
];

export default function OrganizerFit() {
  return (
    <section className="bg-primary-50/50 px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full bg-primary-100 px-4 py-1.5 text-sm font-medium text-primary-700">
            Where SealSend fits
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Choose the smallest system that keeps the event under control
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            SealSend is for recurring organizers who have outgrown fragmented tools but do not need an enterprise event suite.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {alternatives.map((alternative) => {
            const Icon = alternative.icon;
            return (
              <article key={alternative.name} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-neutral-900">{alternative.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  <strong className="text-neutral-900">Useful when:</strong> {alternative.usefulWhen}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  <strong className="text-neutral-900">SealSend fit:</strong> {alternative.sealSendFit}
                </p>
              </article>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-neutral-600">
          This is a product-scope comparison based on the workflows described here, not a claim about every competitor or live delivery performance.
        </p>
        <div className="mt-8 text-center">
          <Link href="/use-cases" className="inline-flex items-center gap-2 font-semibold text-primary-700 hover:text-primary-800">
            See organizer use cases
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

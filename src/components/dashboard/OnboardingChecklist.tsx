import Link from "next/link";
import { Check, Circle } from "lucide-react";

type Props = {
  eventId?: string;
  hasEvent: boolean;
  hasGuest: boolean;
  isPublished: boolean;
  hasInvitation: boolean;
};

export function OnboardingChecklist({ eventId, hasEvent, hasGuest, isPublished, hasInvitation }: Props) {
  if (hasInvitation) return null;
  const steps = [
    { label: "Create an event", complete: hasEvent, href: "/events/new" },
    { label: "Review details and invitation", complete: hasEvent, href: eventId ? `/events/${eventId}/edit` : "/events/new" },
    { label: "Add your first guest", complete: hasGuest, href: eventId ? `/events/${eventId}/guests` : "/events/new" },
    { label: "Publish the event", complete: isPublished, href: eventId ? `/events/${eventId}` : "/events/new" },
    { label: "Send the first invitation", complete: hasInvitation, href: eventId ? `/events/${eventId}/guests` : "/events/new" },
  ];
  const completeCount = steps.filter((step) => step.complete).length;
  return (
    <section aria-labelledby="getting-started-title" className="mb-8 rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="getting-started-title" className="text-lg font-semibold text-gray-900">Get your first event live</h2>
          <p className="mt-1 text-sm text-gray-600">{completeCount} of {steps.length} steps complete. You stay in control before anything is sent.</p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">{Math.round((completeCount / steps.length) * 100)}%</span>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => (
          <li key={step.label}>
            <Link href={step.href} className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              {step.complete ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-green-600" /> : <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />}
              <span>{step.label}</span>
              <span className="sr-only">{step.complete ? "complete" : "not complete"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

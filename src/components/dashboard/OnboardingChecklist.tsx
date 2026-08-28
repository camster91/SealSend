import Link from "next/link";
import { Check, Circle } from "lucide-react";
import {
  buildFirstEventChecklist,
  type FirstEventChecklistEvent,
} from "@/lib/onboarding-checklist";

type Props = {
  event: FirstEventChecklistEvent | null;
  hasGuest: boolean;
  hasInvitation: boolean;
};

export function OnboardingChecklist({ event, hasGuest, hasInvitation }: Props) {
  const steps = buildFirstEventChecklist({ event, hasGuest, hasInvitation });
  if (steps.every((step) => step.complete)) return null;
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
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

import Link from "next/link";
import { ArrowRight, BadgeCheck, Briefcase, Heart, Users, type LucideIcon } from "lucide-react";
import { createMetadata } from "@/lib/metadata";
import { USE_CASES } from "@/lib/use-case-content";
import CTASection from "@/components/marketing/CTASection";

export const metadata = createMetadata({
  title: "Use Cases — Event Workflows for Recurring Organizers",
  description:
    "See how SealSend connects invitations, RSVPs, guest operations, approved updates, and check-in for recurring community organizers.",
  path: "/use-cases",
  keywords: [
    "community event RSVP",
    "nonprofit event invitations",
    "club event management",
    "professional gathering RSVP",
  ],
});

const iconMap: Record<string, LucideIcon> = { Users, Heart, BadgeCheck, Briefcase };

export default function UseCasesIndexPage() {
  return (
    <>
      <section className="gradient-brand px-4 py-20 text-center text-white sm:py-28">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Built for Organizers Who Run the Whole Guest Workflow
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
            SealSend keeps the approved invitation, RSVP decisions, guest follow-up, and event-day status connected for a small organizing team.
          </p>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-2">
            {Object.values(USE_CASES).map((useCase) => {
              const Icon = iconMap[useCase.indexIcon] ?? Users;
              return (
                <Link
                  key={useCase.slug}
                  href={`/use-cases/${useCase.slug}`}
                  className="group rounded-xl border border-border bg-white p-8 transition hover:border-brand-300 hover:shadow-lg"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold">{useCase.heroHeadline}</h2>
                  <p className="mt-2 text-muted-foreground">{useCase.indexDescription}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {useCase.indexFeatures.map((feature) => (
                      <li key={feature} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                    Review this workflow
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}

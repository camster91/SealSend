import Link from "next/link";
import { Users, Heart, BadgeCheck, Briefcase, ArrowRight } from "lucide-react";

const useCases = [
  {
    icon: Users,
    title: "Community Events",
    description: "Guest operations for recurring community gatherings.",
    href: "/use-cases/community-events",
  },
  {
    icon: Heart,
    title: "Local Nonprofits",
    description: "Custom RSVP and volunteer coordination for local teams.",
    href: "/use-cases/nonprofit-events",
  },
  {
    icon: BadgeCheck,
    title: "Clubs & Associations",
    description: "Repeatable event workflows for chapters and members.",
    href: "/use-cases/clubs-associations",
  },
  {
    icon: Briefcase,
    title: "Professional Gatherings",
    description: "Controlled guest workflows without enterprise overhead.",
    href: "/use-cases/professional-gatherings",
  },
];

export default function UseCaseHighlights() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Designed for recurring organizers
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Keep invitations, guest decisions, approved updates, and check-in connected.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((uc) => (
            <Link
              key={uc.title}
              href={uc.href}
              className="group rounded-xl border border-border bg-white p-6 transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                <uc.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{uc.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {uc.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                Learn more
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

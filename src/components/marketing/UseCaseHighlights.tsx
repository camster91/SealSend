import Link from "next/link";
import { Heart, Baby, Cake, Briefcase, ArrowRight } from "lucide-react";

const useCases = [
  {
    icon: Heart,
    title: "Weddings",
    description: "Elegant digital wedding invitations with RSVP tracking.",
    href: "/use-cases/weddings",
  },
  {
    icon: Baby,
    title: "Baby Showers",
    description: "Adorable invites to celebrate the newest arrival.",
    href: "/use-cases/baby-showers",
  },
  {
    icon: Cake,
    title: "Birthday Parties",
    description: "Fun, vibrant invitations for every age and theme.",
    href: "/use-cases/birthday-parties",
  },
  {
    icon: Briefcase,
    title: "Corporate Events",
    description: "Professional invitations for conferences, galas, and more.",
    href: "/use-cases/corporate-events",
  },
];

export default function UseCaseHighlights() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Perfect for Every Occasion
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            From intimate gatherings to large celebrations, Seal and Send has you covered.
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

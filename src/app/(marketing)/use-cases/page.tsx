import Link from "next/link";
import { Heart, Baby, Cake, Briefcase, ArrowRight } from "lucide-react";
import { createMetadata } from "@/lib/metadata";
import CTASection from "@/components/marketing/CTASection";

export const metadata = createMetadata({
  title: "Use Cases — Digital Invitations for Every Occasion",
  description:
    "Discover how Seal and Send helps you create stunning digital invitations for weddings, baby showers, birthday parties, corporate events, and more.",
  path: "/use-cases",
  keywords: [
    "digital invitations",
    "wedding invitations online",
    "baby shower invitations",
    "birthday party invitations",
    "corporate event invitations",
  ],
});

const useCases = [
  {
    icon: Heart,
    slug: "weddings",
    title: "Weddings",
    description:
      "Create elegant digital wedding invitations with RSVP tracking, meal preferences, plus-one management, and registry integration.",
    features: ["Registry integration", "Meal preferences", "Plus-one tracking", "Save the dates"],
  },
  {
    icon: Baby,
    slug: "baby-showers",
    title: "Baby Showers",
    description:
      "Celebrate the upcoming arrival with adorable invitations, gift registry links, and easy guest management.",
    features: ["Registry links", "Gender reveal option", "Gift tracking", "Photo sharing"],
  },
  {
    icon: Cake,
    slug: "birthday-parties",
    title: "Birthday Parties",
    description:
      "From first birthdays to milestone celebrations, create fun and vibrant invitations for every age and theme.",
    features: ["Age-appropriate themes", "RSVP by date", "Gift preferences", "Photo gallery"],
  },
  {
    icon: Briefcase,
    slug: "corporate-events",
    title: "Corporate Events",
    description:
      "Professional invitations for company events, conferences, galas, and team gatherings with attendee tracking.",
    features: ["Branded templates", "Calendar invites", "Attendee tracking", "Polls & surveys"],
  },
];

export default function UseCasesIndexPage() {
  return (
    <>
      {/* Hero */}
      <section className="gradient-brand px-4 py-20 text-center text-white sm:py-28">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Perfect for Every Occasion
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
            From intimate gatherings to large celebrations, Seal and Send makes
            it easy to create stunning digital invitations.
          </p>
        </div>
      </section>

      {/* Use Cases Grid */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-2">
            {useCases.map((uc) => (
              <Link
                key={uc.slug}
                href={`/use-cases/${uc.slug}`}
                className="group rounded-xl border border-border bg-white p-8 transition hover:border-brand-300 hover:shadow-lg"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                  <uc.icon className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-2xl font-bold">{uc.title}</h2>
                <p className="mt-2 text-muted-foreground">{uc.description}</p>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {uc.features.map((f) => (
                    <li
                      key={f}
                      className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                    >
                      {f}
                    </li>
                  ))}
                </ul>

                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                  Learn more
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}

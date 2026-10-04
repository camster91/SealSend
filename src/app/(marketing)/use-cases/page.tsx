import Image from "next/image";
import Link from "next/link";
import { createMetadata } from "@/lib/metadata";
import { USE_CASES } from "@/lib/use-case-content";
import OrganizerFit from "@/components/marketing/OrganizerFit";
import CTASection from "@/components/marketing/CTASection";

export const metadata = createMetadata({
  title: "Use Cases: Weddings, Parties, Community Events and Planners",
  description:
    "See how SealSend handles invitations, RSVPs, guest updates and check-in for event planners, weddings, birthday parties, community groups, clubs and nonprofits.",
  path: "/use-cases",
  keywords: [
    "wedding RSVP website",
    "community event RSVP",
    "event planner client approval",
    "nonprofit event invitations",
    "club event management",
  ],
});

export default function UseCasesIndexPage() {
  return (
    <>
      <section className="px-4 pb-12 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="max-w-3xl font-display text-5xl text-ink sm:text-6xl">
            One link for every kind of gathering.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-700">
            Whether you plan events for clients, run the club calendar or host one big day, SealSend keeps the invitation, the replies and the door in one place.
          </p>
        </div>
      </section>

      <section aria-label="Use cases" className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
        <ul className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(USE_CASES).map((useCase) => (
            <li key={useCase.slug}>
              <Link
                href={`/use-cases/${useCase.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={useCase.image}
                    alt={useCase.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="text-xl font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
                    {useCase.name}
                  </h2>
                  <p className="mt-2 leading-relaxed text-neutral-600">{useCase.indexDescription}</p>
                  <ul className="mt-5 flex flex-wrap gap-2" aria-label={`${useCase.name} highlights`}>
                    {useCase.indexFeatures.map((feature) => (
                      <li key={feature} className="rounded-full border border-border px-3 py-1 text-sm text-neutral-700">
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <OrganizerFit />
      <CTASection />
    </>
  );
}

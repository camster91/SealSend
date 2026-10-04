import Image from "next/image";
import Link from "next/link";
import { USE_CASES } from "@/lib/use-case-content";

const cards = [
  { slug: "weddings", line: "Every RSVP, meal choice and plus-one in one list." },
  { slug: "birthday-parties", line: "Know how many kids are coming before you buy the cake." },
  { slug: "community-events", line: "Run the monthly potluck without the spreadsheet." },
  { slug: "event-planners", line: "Client approvals, your branding, and a workspace for your team." },
];

export default function UseCaseGrid() {
  return (
    <section aria-labelledby="use-case-grid-title" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h2 id="use-case-grid-title" className="font-display text-4xl text-ink sm:text-5xl">
            For the events you actually host
          </h2>
          <Link href="/use-cases" className="inline-flex min-h-11 items-center text-base font-semibold text-ink underline underline-offset-4 hover:text-wax">
            All use cases
          </Link>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ slug, line }) => {
            const useCase = USE_CASES[slug];
            return (
              <li key={slug}>
                <Link
                  href={`/use-cases/${slug}`}
                  className="group block overflow-hidden rounded-2xl border border-border bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={useCase.image}
                      alt={useCase.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
                      {useCase.name}
                    </h3>
                    <p className="mt-1 leading-relaxed text-neutral-600">{line}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

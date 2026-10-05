import Image from "next/image";
import { SecondaryCta } from "@/components/marketing/Cta";

const points = [
  "Workspaces with owner, admin, planner and check-in roles.",
  "Your logo, colours and sender name on every event.",
  "Client review links with live RSVP totals and recorded approvals.",
  "Repeat an event and keep the guest list.",
  "Signed webhooks for Zapier, Make or your CRM.",
];

export default function OrganizersSection() {
  return (
    <section aria-labelledby="organizers-title" className="px-4 pb-12 sm:px-6 sm:pb-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 rounded-2xl border border-border bg-white p-5 sm:p-10 lg:grid-cols-12 lg:gap-16 lg:p-14">
        <div className="lg:col-span-5">
          <div className="flex gap-3">
            <Image src="/brand/icons/team.svg" alt="" width={56} height={56} className="h-11 w-11 sm:h-14 sm:w-14" />
            <Image src="/brand/icons/repeat.svg" alt="" width={56} height={56} className="h-11 w-11 sm:h-14 sm:w-14" />
          </div>
          <h2 id="organizers-title" className="mt-5 font-display sm:mt-6 text-4xl text-ink sm:text-5xl">
            Built for people who host often.
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-neutral-600">
            For planners, studios, clubs and community groups who run event after event.
          </p>
          <SecondaryCta href="/pricing" className="mt-8">
            See plans for organizers
          </SecondaryCta>
        </div>
        <ul className="divide-y divide-border border-y border-border lg:col-span-7 lg:self-center">
          {points.map((point) => (
            <li key={point} className="flex gap-4 py-3 text-base text-ink sm:py-4 sm:text-lg">
              <span aria-hidden="true" className="mt-3 h-px w-5 shrink-0 bg-foil" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

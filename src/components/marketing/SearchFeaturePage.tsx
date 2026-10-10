import Link from "next/link";
import DigitalInvitationVisual from "./DigitalInvitationVisual";
import { PrimaryCta, PRIMARY_CTA_NOTE } from "./Cta";

type Section = { title: string; text: string };

export function SearchFeaturePage({ eyebrow, title, intro, sections, questions, related }: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Section[];
  questions: Section[];
  related: { title: string; href: string }[];
}) {
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-ink">{eyebrow}</p>
          <h1 className="mt-5 font-display text-4xl leading-tight text-ink sm:text-5xl">{title}</h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-700">{intro}</p>
          <PrimaryCta className="mt-8" />
          <p className="mt-4 text-sm text-neutral-600">{PRIMARY_CTA_NOTE}</p>
        </div>
        <DigitalInvitationVisual />
      </section>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8" aria-label="Planning your event">
        <div className="grid gap-8 sm:grid-cols-2">
          {sections.map(section => (
            <div key={section.title} className="rounded-2xl border border-border bg-white p-6">
              <h2 className="font-display text-2xl text-ink">{section.title}</h2>
              <p className="mt-4 leading-relaxed text-neutral-700">{section.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="font-display text-3xl text-ink">Before you get started</h2>
        <dl className="mt-8 space-y-8">
          {questions.map(question => (
            <div key={question.title}>
              <dt className="text-lg font-semibold text-ink">{question.title}</dt>
              <dd className="mt-3 leading-relaxed text-neutral-700">{question.text}</dd>
            </div>
          ))}
        </dl>
        <h2 className="mt-12 font-display text-2xl text-ink">Plan the rest of your gathering</h2>
        <ul className="mt-4 space-y-2">
          {related.map(link => <li key={link.href}><Link className="inline-flex min-h-11 items-center text-ink underline underline-offset-4" href={link.href}>{link.title}</Link></li>)}
        </ul>
      </section>
    </>
  );
}

"use client";

import { useId, useState } from "react";
import { Check, ArrowRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SecondaryCta } from "./Cta";

const examples = [
  { name: "Birthday", title: "A birthday worth celebrating", detail: "Saturday · 4 pm · The backyard", note: "Cake, good friends, and absolutely no speeches.", colour: "bg-[#e5daf4]" },
  { name: "Potluck", title: "A little potluck, a lot of good company", detail: "Sunday · 1 pm · The community garden", note: "Bring a favourite dish. We’ll bring the extra chairs.", colour: "bg-[#f5e5a9]" },
  { name: "Book club", title: "One more chapter, together", detail: "Thursday · 7 pm · The corner café", note: "A good book, a warm drink, and room for another opinion.", colour: "bg-[#dce9d6]" },
];

export default function InvitationPlayground() {
  const [selected, setSelected] = useState(0);
  const [replied, setReplied] = useState(false);
  const titleId = useId();
  const current = examples[selected];
  return (
    <section aria-label="Try an invitation" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-10 rounded-[2rem] border border-ink/10 bg-white p-6 sm:p-10 lg:grid-cols-2 lg:p-14">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-wax">A tiny test drive</p>
          <h2 className="mt-4 font-display text-4xl text-ink sm:text-5xl">An invite with a little more you.</h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-neutral-600">Pick a gathering and try a reply. Your real event can have its own design, questions, and guest list.</p>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Example gathering">
            {examples.map((example, index) => <button key={example.name} type="button" aria-pressed={selected === index} onClick={() => {setSelected(index); setReplied(false);}} className={cn("min-h-11 rounded-full border px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink", selected === index ? "border-ink bg-ink text-white" : "border-ink/25 bg-white text-ink hover:bg-cotton")}>{example.name}</button>)}
          </div>
          <p className="mt-4 text-sm text-neutral-600">An interactive example. Nothing is saved or sent.</p>
          <SecondaryCta href="/how-it-works" className="mt-6">Explore the real workflow <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></SecondaryCta>
        </div>
        <article aria-labelledby={titleId} className={cn("rounded-[1.75rem] border border-ink/10 p-6 text-center sm:p-10",current.colour)}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink">You&apos;re invited</p>
          <h3 id={titleId} className="mt-5 font-display text-4xl leading-tight text-ink">{current.title}</h3>
          <p className="mt-5 text-sm font-semibold text-ink">{current.detail}</p>
          <p className="mx-auto mt-4 max-w-xs text-neutral-700">{current.note}</p>
          <div className="mt-7 min-h-32">
            <div role="status" aria-live="polite" aria-atomic="true">{replied && <><Check aria-hidden="true" className="mx-auto mb-2 h-7 w-7 text-sage-dark" /><p className="text-sm font-semibold text-ink">You’re on the example guest list. No RSVP was sent.</p></>}</div>
            {replied ? <button type="button" onClick={() => setReplied(false)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/30 px-5 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4"><RotateCcw aria-hidden="true" className="h-4 w-4" />Try again</button> : <button type="button" onClick={() => setReplied(true)} className="min-h-11 rounded-xl bg-ink px-7 py-3 font-semibold text-white transition-colors hover:bg-wax focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">Try an RSVP</button>}
          </div>
        </article>
      </div>
    </section>
  );
}

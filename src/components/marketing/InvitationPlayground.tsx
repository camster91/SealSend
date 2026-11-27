"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, RotateCcw, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { eventDisplayFontFamily, eventFontFamily } from "@/lib/event-font";
import { ThemeMotif } from "@/components/public-event/ThemeMotif";
import type { EventLayoutStyle, EventMotif } from "@/types/database";
import { PrimaryCta, SecondaryCta } from "./Cta";

interface PlaygroundExample {
  name: string;
  templateId: string;
  eyebrow: string;
  title: string;
  detail: string;
  note: string;
  primaryColor: string;
  backgroundColor: string;
  displayFont: string;
  fontFamily: string;
  layoutStyle: EventLayoutStyle;
  motif: EventMotif;
  buttonStyle: "rounded" | "pill" | "square";
  schedule?: string[];
  mealOptions?: string[];
}

const examples: PlaygroundExample[] = [
  {
    name: "Wedding",
    templateId: "botanical-garden",
    eyebrow: "Together with their families",
    title: "Maya & Lucas",
    detail: "Saturday, June 14 · 4 pm · Conservatory Gardens",
    note: "Ceremony in the glasshouse, followed by dinner under the string lights.",
    primaryColor: "#2f4f4f",
    backgroundColor: "#f7f5ef",
    displayFont: "Cormorant Garamond",
    fontFamily: "DM Sans",
    layoutStyle: "arch",
    motif: "botanical",
    buttonStyle: "pill",
    schedule: ["Welcome drinks · Fri 7 pm", "Ceremony & dinner · Sat 4 pm"],
    mealOptions: ["Herb chicken", "Pan-seared salmon", "Wild mushroom risotto"],
  },
  {
    name: "Birthday",
    templateId: "birthday-confetti",
    eyebrow: "You're invited",
    title: "Nora's 30th",
    detail: "Saturday · 7 pm · The courtyard",
    note: "Good friends, wood-fired pizza, and absolutely no speeches.",
    primaryColor: "#6d28d9",
    backgroundColor: "#f6f1fc",
    displayFont: "Fraunces",
    fontFamily: "DM Sans",
    layoutStyle: "classic",
    motif: "celestial",
    buttonStyle: "pill",
  },
  {
    name: "Dinner party",
    templateId: "golden-hour-dinner",
    eyebrow: "Pull up a chair",
    title: "Autumn Supper Club",
    detail: "Sunday · 6 pm · 42 Maple Terrace",
    note: "Seasonal tasting menu around one long table. Bring your favourite bottle.",
    primaryColor: "#7c2d12",
    backgroundColor: "#fbf6ec",
    displayFont: "Playfair Display",
    fontFamily: "DM Sans",
    layoutStyle: "editorial",
    motif: "frame",
    buttonStyle: "square",
    mealOptions: ["Everything", "Vegetarian", "Gluten-free"],
  },
];

type DemoStatus = "attending" | "maybe" | "not_attending";

export default function InvitationPlayground() {
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<DemoStatus>("attending");
  const [plusOne, setPlusOne] = useState(false);
  const [meal, setMeal] = useState("");
  const [replied, setReplied] = useState(false);
  const titleId = useId();
  const current = examples[selected];

  const selectExample = (index: number) => {
    setSelected(index);
    setStatus("attending");
    setPlusOne(false);
    setMeal(examples[index].mealOptions?.[0] ?? "");
    setReplied(false);
  };

  const activeMeal = meal || current.mealOptions?.[0] || "";
  const displayFont = eventDisplayFontFamily(current.displayFont, current.fontFamily);
  const bodyFont = eventFontFamily(current.fontFamily);
  const frameRadius =
    current.layoutStyle === "arch"
      ? "rounded-t-[160px] rounded-b-3xl"
      : current.layoutStyle === "editorial"
        ? "rounded-none"
        : "rounded-3xl";
  const btnRadius =
    current.buttonStyle === "pill" ? "9999px" : current.buttonStyle === "square" ? "2px" : "10px";

  return (
    <section id="try-invitation" aria-label="Try an invitation" className="scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-10 rounded-[2rem] border border-ink/10 bg-white p-6 sm:p-10 lg:grid-cols-2 lg:p-14">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-wax">Try it</p>
          <h2 className="mt-4 font-display text-4xl text-ink sm:text-5xl">See what your guests see.</h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-neutral-600">
            Pick a style, try a reply with a plus-one or meal pick, and see how calm the guest experience feels.
          </p>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Example gathering">
            {examples.map((example, index) => (
              <button
                key={example.name}
                type="button"
                aria-pressed={selected === index}
                onClick={() => selectExample(index)}
                className={cn(
                  "min-h-11 rounded-full border px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink",
                  selected === index ? "border-ink bg-ink text-white" : "border-ink/25 bg-white text-ink hover:bg-cotton",
                )}
              >
                {example.name}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-neutral-600">An interactive example. Nothing is saved or sent.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <PrimaryCta label="Make your own invitation" />
            <SecondaryCta href="/templates">
              Browse 16 styles <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
            </SecondaryCta>
            <Link href="/how-it-works" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink underline underline-offset-4 hover:text-wax">
              See how it works
            </Link>
          </div>
        </div>

        <div
          className="rounded-[2rem] border border-ink/10 p-4 sm:p-7"
          style={{ backgroundColor: current.backgroundColor, fontFamily: bodyFont }}
        >
          <article
            aria-labelledby={titleId}
            className={cn(
              "relative mx-auto max-w-md px-6 py-8 text-center sm:px-8",
              frameRadius,
              current.layoutStyle === "editorial" ? "border-y-2 bg-white/85" : "border bg-white/85 shadow-sm",
            )}
            style={{ borderColor: `${current.primaryColor}38` }}
          >
            {current.layoutStyle === "classic" && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-2 rounded-[1.25rem] border"
                style={{ borderColor: `${current.primaryColor}20` }}
              />
            )}

            <ThemeMotif motif={current.motif} color={current.primaryColor} title={current.title} />
            <p
              className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: current.primaryColor }}
            >
              {current.eyebrow}
            </p>
            <h3
              id={titleId}
              className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl"
              style={{ color: current.primaryColor, fontFamily: displayFont }}
            >
              {current.title}
            </h3>
            <p className="mt-3 text-sm font-semibold text-ink">{current.detail}</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-700">{current.note}</p>

            {current.schedule && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {current.schedule.map((slot) => (
                  <span
                    key={slot}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700"
                  >
                    <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" style={{ color: current.primaryColor }} />
                    {slot}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-neutral-200/80 pt-5">
              <div role="status" aria-live="polite" aria-atomic="true">
                {replied && (
                  <div className="space-y-2">
                    <Check aria-hidden="true" className="mx-auto h-7 w-7 text-sage-dark" />
                    <p className="text-sm font-semibold text-ink">
                      {status === "attending"
                        ? `Going${plusOne ? " · 2 guests" : ""}${activeMeal ? ` · ${activeMeal}` : ""}`
                        : status === "maybe"
                          ? "Marked as maybe"
                          : "Marked as can't go"}
                    </p>
                    <p className="text-xs text-neutral-600">No RSVP was sent.</p>
                  </div>
                )}
              </div>

              {replied ? (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReplied(false)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/25 bg-white px-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4"
                  >
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    Try again
                  </button>
                  <Link
                    href={`/events/new?template=${current.templateId}`}
                    className="inline-flex min-h-11 items-center px-4 text-sm font-semibold text-white"
                    style={{ backgroundColor: current.primaryColor, borderRadius: btnRadius }}
                  >
                    Use this style
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 text-left">
                  <div role="group" aria-label="Example reply choice" className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { value: "attending", label: "Going" },
                        { value: "maybe", label: "Maybe" },
                        { value: "not_attending", label: "Can't go" },
                      ] as const
                    ).map((opt) => {
                      const active = status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setStatus(opt.value)}
                          className="min-h-11 border px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                          style={{
                            borderRadius: btnRadius,
                            ...(active
                              ? { backgroundColor: current.primaryColor, borderColor: current.primaryColor, color: "#fff" }
                              : { borderColor: "#d4d4d4", backgroundColor: "#fff", color: "#1b2a4a" }),
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {status !== "not_attending" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-700">
                      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={plusOne}
                          onChange={(e) => setPlusOne(e.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                        Bringing a +1
                      </label>
                      {current.mealOptions && (
                        <label className="inline-flex items-center gap-1.5">
                          <span className="sr-only">Meal preference</span>
                          <select
                            value={activeMeal}
                            onChange={(e) => setMeal(e.target.value)}
                            className="min-h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-xs text-ink"
                          >
                            {current.mealOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setReplied(true)}
                    className="min-h-11 w-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                    style={{ backgroundColor: current.primaryColor, borderRadius: btnRadius }}
                  >
                    Try an RSVP
                  </button>
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

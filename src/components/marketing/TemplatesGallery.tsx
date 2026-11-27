"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EVENT_TEMPLATES } from "@/lib/event-templates";
import { eventDisplayFontFamily, eventFontFamily } from "@/lib/event-font";
import { ThemeMotif } from "@/components/public-event/ThemeMotif";
import { cn } from "@/lib/utils";

const LAYOUT_LABELS: Record<string, string> = {
  classic: "Classic stationery",
  editorial: "Editorial",
  arch: "Arched frame",
  minimal: "Minimal",
};

export function TemplatesGallery() {
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const template of EVENT_TEMPLATES) {
      seen.add(template.category);
    }
    return ["All", ...seen];
  }, []);

  const [selectedCategory, setSelectedCategory] = useState("All");

  const visibleTemplates = useMemo(
    () =>
      selectedCategory === "All"
        ? EVENT_TEMPLATES
        : EVENT_TEMPLATES.filter((t) => t.category === selectedCategory),
    [selectedCategory],
  );

  return (
    <div>
      <div
        role="group"
        aria-label="Filter templates by occasion"
        className="mb-8 flex flex-wrap gap-2"
      >
        {categories.map((category) => {
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-ink/20 bg-white text-ink hover:bg-cotton",
              )}
            >
              {category}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTemplates.map((template) => {
          const c = template.customization;
          const displayFont = eventDisplayFontFamily(c.displayFont, c.fontFamily);
          const bodyFont = eventFontFamily(c.fontFamily);
          const layout = c.layoutStyle ?? "classic";
          const radius =
            layout === "arch"
              ? "rounded-t-[140px] rounded-b-xl"
              : layout === "editorial"
                ? "rounded-none"
                : "rounded-xl";
          const buttonRadius =
            c.buttonStyle === "pill" ? "9999px" : c.buttonStyle === "square" ? "0px" : "8px";
          const fontPair =
            c.displayFont && c.displayFont !== c.fontFamily
              ? `${c.displayFont} + ${c.fontFamily}`
              : c.fontFamily;

          return (
            <article
              key={template.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                className="flex min-h-56 items-center justify-center p-5"
                style={{ backgroundColor: c.backgroundColor, fontFamily: bodyFont }}
              >
                <div
                  className={cn(
                    "relative flex w-full flex-col items-center justify-center gap-2 px-5 py-6 text-center",
                    radius,
                    layout === "editorial"
                      ? "border-y-2"
                      : layout === "minimal"
                        ? ""
                        : "border bg-white/75 shadow-sm",
                  )}
                  style={{
                    borderColor: layout === "minimal" ? "transparent" : `${c.primaryColor}40`,
                  }}
                >
                  {layout === "classic" && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-1.5 rounded-lg border"
                      style={{ borderColor: `${c.primaryColor}22` }}
                    />
                  )}
                  <ThemeMotif motif={c.motif} color={c.primaryColor} title={template.name} />
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: c.primaryColor }}
                  >
                    {template.category}
                  </p>
                  <p
                    className="text-2xl font-semibold leading-tight"
                    style={{ color: c.primaryColor, fontFamily: displayFont }}
                  >
                    {template.name}
                  </p>
                  <span
                    className="mt-2 inline-block px-4 py-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: c.primaryColor, borderRadius: buttonRadius }}
                  >
                    RSVP
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold text-ink">{template.name}</h2>
                    <span className="text-xs text-neutral-600">
                      {LAYOUT_LABELS[layout] ?? "Classic"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                    {template.description}
                  </p>
                  <p className="mt-2 text-xs text-neutral-600">Fonts: {fontPair}</p>
                </div>

                <Link
                  href={`/events/new?template=${template.id}`}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-wax focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                >
                  Use this template
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

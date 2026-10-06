"use client";

import { cn } from "@/lib/utils";
import { BUILDER_SCREENS, type BuilderScreen } from "@/lib/event-builder/schema";

export const SCREEN_NAMES: Record<BuilderScreen, string> = {
  basics: "Basics",
  look: "The look",
  guests: "Guests",
  review: "Review",
};

interface StepNavProps {
  current: BuilderScreen;
  /** Highest step index the host has reached; every step is open when `all` is set. */
  reached: number;
  all: boolean;
  /** Disables every step while the screen has values that would be lost by leaving. */
  locked?: boolean;
  onSelect: (screen: BuilderScreen) => void;
}

export function StepNav({ current, reached, all, locked = false, onSelect }: StepNavProps) {
  const index = BUILDER_SCREENS.indexOf(current);
  return (
    <nav aria-label="Steps">
      <ol className="flex gap-2">
        {BUILDER_SCREENS.map((screen, i) => {
          const open = !locked && (all || i <= reached);
          const isCurrent = screen === current;
          return (
            <li key={screen} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!open}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(screen)}
                className={cn(
                  "flex min-h-11 w-full flex-col justify-end gap-1.5 rounded-lg text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
                  isCurrent ? "font-semibold text-ink" : open ? "text-muted-foreground hover:text-ink" : "text-ink/40",
                )}
              >
                <span className="truncate">{SCREEN_NAMES[screen]}</span>
                <span className={cn("h-1 rounded-full", isCurrent || i < index ? "bg-ink" : open ? "bg-ink/25" : "bg-border")} />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

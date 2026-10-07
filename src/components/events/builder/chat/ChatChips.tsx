"use client";

import { cn } from "@/lib/utils";
import { REVIEW_CHIP } from "@/lib/event-builder/chat-client";

interface ChatChipsProps {
  chips: string[];
  disabled?: boolean;
  onPick: (chip: string) => void;
}

/** Quick answers the host can tap instead of typing. */
export function ChatChips({ chips, disabled = false, onPick }: ChatChipsProps) {
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Quick answers" className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const primary = chip === REVIEW_CHIP;
        return (
          <li key={chip}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(chip)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60",
                primary
                  ? "bg-wax text-white hover:bg-wax-dark"
                  : "border border-ink/20 bg-white text-ink hover:border-ink",
              )}
            >
              {chip}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

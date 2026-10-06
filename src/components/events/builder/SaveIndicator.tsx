"use client";

import { Button } from "@/components/ui/Button";
import type { SaveStatus } from "@/lib/event-builder/save-machine";

interface SaveIndicatorProps {
  status: SaveStatus;
  onRetry: () => void;
}

function label(status: SaveStatus): string {
  switch (status.kind) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "retrying":
      return "Not saved, retrying…";
    case "failed":
      return status.message;
    default:
      return "";
  }
}

export function SaveIndicator({ status, onRetry }: SaveIndicatorProps) {
  const text = label(status);
  const isProblem = status.kind === "retrying" || status.kind === "failed";
  return (
    <div className="flex min-h-11 items-center gap-2 text-sm">
      <span aria-live="polite" className={isProblem ? "font-medium text-ink" : "text-muted-foreground"}>
        {text}
      </span>
      {status.kind === "failed" && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

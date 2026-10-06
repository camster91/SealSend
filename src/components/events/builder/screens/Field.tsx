"use client";

import type { ReactNode } from "react";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Shown at the right of the label row, such as a character counter. */
  aside?: ReactNode;
  children: (aria: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

/** A real label, a control, and an error tied to it with aria-describedby. */
export function Field({ id, label, error, hint, aside, children }: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
        {aside}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && <p id={hintId} className="text-sm text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-sm font-medium text-wax">{error}</p>}
    </div>
  );
}

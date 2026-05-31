"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  showCharacterCount?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, showCharacterCount, value, maxLength, ...props }, ref) => {
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className="space-y-1.5">
        <div className="flex justify-between items-end">
          {label && (
            <label
              htmlFor={id}
              className="block text-sm font-medium text-neutral-700"
            >
              {label}
            </label>
          )}
          {showCharacterCount && (
            <span
              className="text-xs text-neutral-400 pb-0.5"
              aria-live="polite"
            >
              {currentLength}{maxLength ? ` / ${maxLength}` : ""} characters
            </span>
          )}
        </div>
        <textarea
          id={id}
          ref={ref}
          value={value}
          maxLength={maxLength}
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border border-input bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-accent-red focus:border-accent-red focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-accent-red">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };

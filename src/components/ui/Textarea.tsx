"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, required, ...props }, ref) => {
    const errorId = id ? `${id}-error` : undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-neutral-700"
          >
            {label}
            {required && (
              <span className="ml-1 text-accent-red" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <textarea
          id={id}
          ref={ref}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border border-input bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-accent-red focus-visible:border-accent-red focus-visible:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-accent-red">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };

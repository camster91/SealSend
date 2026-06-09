"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, placeholder, required, ...props }, ref) => {
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
        <div className="relative">
          <select
            id={id}
            ref={ref}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "flex h-10 w-full appearance-none rounded-lg border border-input bg-white px-3 py-2 pr-8 text-sm transition-colors focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-accent-red focus-visible:border-accent-red focus-visible:ring-red-500/20",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {error && (
          <p id={errorId} className="text-sm text-accent-red">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };

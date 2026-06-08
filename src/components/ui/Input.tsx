"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-neutral-700"
          >
            {label} {props.required && <span className="text-accent-red">*</span>}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50",
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
Input.displayName = "Input";

export { Input };

"use client";

import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, required, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-neutral-700"
          >
            {label}
            {required && <span className="ml-1 text-accent-red text-xs" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            id={id}
            ref={ref}
            type={inputType}
            required={required}
            className={cn(
              "flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50",
              isPassword && "pr-10",
              error && "border-accent-red focus:border-accent-red focus:ring-red-500/20",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-accent-red">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };

"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./Tooltip";

type ButtonVariant = "default" | "outline" | "ghost" | "destructive" | "link";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  tooltip?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  outline:
    "border border-border bg-transparent hover:bg-neutral-100 text-foreground",
  ghost: "hover:bg-neutral-100 text-foreground",
  destructive:
    "bg-error-500 text-white hover:bg-error-600 shadow-sm",
  link: "text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline p-0 h-auto min-h-0",
};

const sizeStyles: Record<ButtonSize, string> = {
  // Prefer ≥44px touch targets (Apple HIG)
  sm: "min-h-11 px-3 text-sm rounded-xl",
  md: "min-h-11 px-4 text-sm rounded-xl",
  lg: "min-h-12 px-6 text-base rounded-xl",
  icon: "h-11 w-11 rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      loading = false,
      tooltip,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const button = (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-label={tooltip || props["aria-label"]}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );

    if (tooltip) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return button;
  }
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps };

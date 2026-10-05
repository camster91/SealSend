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
    "bg-ink text-white hover:bg-primary-700",
  outline:
    "border border-input bg-white hover:bg-neutral-50 text-ink",
  ghost: "hover:bg-neutral-100 text-ink",
  destructive:
    "bg-error-600 text-white hover:bg-error-700",
  link: "text-ink hover:text-primary-700 underline underline-offset-4 decoration-ink/30 hover:decoration-ink p-0 h-auto",
};

const sizeStyles: Record<ButtonSize, string> = {
  // When any pointer is touch (including touchscreen laptops), every size grows to at least 44px, the minimum
  // comfortable tap target; mouse layouts keep their compact sizes.
  sm: "h-8 px-3 text-sm rounded-lg any-pointer-coarse:h-11",
  md: "h-10 px-4 text-sm rounded-lg any-pointer-coarse:h-11",
  lg: "h-12 px-6 text-base rounded-lg",
  icon: "h-10 w-10 rounded-lg any-pointer-coarse:h-11 any-pointer-coarse:w-11",
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
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || loading}
        aria-label={tooltip || props["aria-label"]}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

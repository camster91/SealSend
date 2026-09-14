"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerVariant = "error" | "success" | "info" | "warning";

interface InlineBannerProps {
  variant?: BannerVariant;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const STYLES: Record<BannerVariant, string> = {
  error: "border-error-100 bg-error-50 text-error-600",
  success: "border-success-100 bg-success-50 text-success-700",
  info: "border-brand-100 bg-brand-50 text-brand-700",
  warning: "border-warning-100 bg-warning-50 text-warning-600",
};

const ICONS: Record<BannerVariant, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
  warning: AlertCircle,
};

export function InlineBanner({
  variant = "error",
  title,
  children,
  onDismiss,
  className,
}: InlineBannerProps) {
  const Icon = ICONS[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        STYLES[variant],
        className
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-semibold text-neutral-900">{title}</p>}
        <div className={cn(title && "mt-0.5 text-neutral-700")}>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

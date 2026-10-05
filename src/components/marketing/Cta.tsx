import Link from "next/link";
import { BETA_MODE } from "@/lib/constants";
import { cn } from "@/lib/utils";

// The one primary action on every marketing page goes into the app at /signup.
export const PRIMARY_CTA_LABEL = BETA_MODE ? "Join the free beta" : "Plan your first event free";
export const PRIMARY_CTA_NOTE = BETA_MODE
  ? "Free during the beta: one event, up to 100 guests."
  : "Free for one event up to 50 guests. No card needed.";

const base =
  "inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

/** Ink button; Wax on hover is the brand's one key-moment accent. */
export function PrimaryCta({
  className,
  label = PRIMARY_CTA_LABEL,
  onInk = false,
}: {
  className?: string;
  label?: string;
  onInk?: boolean;
}) {
  return (
    <Link
      href="/signup"
      className={cn(
        base,
        onInk
          ? "bg-white text-ink hover:bg-cotton focus-visible:ring-white focus-visible:ring-offset-ink"
          : "bg-ink text-white hover:bg-wax focus-visible:ring-ink",
        className,
      )}
    >
      {label}
    </Link>
  );
}

export function SecondaryCta({
  href,
  children,
  className,
  onInk = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onInk?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        base,
        onInk
          ? "border border-white/40 text-white hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-ink"
          : "border border-ink/20 bg-white text-ink hover:border-ink/40 focus-visible:ring-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

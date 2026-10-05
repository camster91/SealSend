import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "purple" | "blue" | "green" | "amber";
  className?: string;
}

// Quiet, solid icon tiles from the Brand Lock tokens. "purple" and "blue" are kept as prop values
// for existing callers and both render as Ink.
const colorMap = {
  purple: "bg-primary-50 text-ink",
  blue: "bg-primary-50 text-ink",
  green: "bg-success-50 text-success-700",
  amber: "bg-warning-50 text-neutral-700",
};

export function StatsCard({
  title,
  value,
  icon,
  color = "purple",
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-white",
        className
      )}
    >
      <div className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            colorMap[color]
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-600">{title}</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
        </div>
      </div>
    </div>
  );
}

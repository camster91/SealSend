import { cn } from "@/lib/utils";

/**
 * Grey placeholder rows shown while a list loads, so the page keeps its
 * shape instead of jumping when the data arrives.
 */
export function TableSkeleton({ rows = 5, columns = 4, label = "Loading", className }: { rows?: number; columns?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("overflow-hidden rounded-xl border border-border bg-white", className)}>
      <div className="flex gap-4 border-b border-border bg-neutral-50 px-4 py-3">
        {Array.from({ length: columns }, (_, column) => (
          <div key={column} className="h-3 flex-1 rounded bg-neutral-200 motion-safe:animate-pulse" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4 border-b border-border px-4 py-4 last:border-b-0">
          {Array.from({ length: columns }, (_, column) => (
            <div
              key={column}
              className={cn("h-4 flex-1 rounded bg-neutral-100 motion-safe:animate-pulse", column === 0 && "max-w-[40%]")}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

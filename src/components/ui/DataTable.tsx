"use client";

import { Fragment, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: T) => void;
  renderExpandedRow?: (item: T) => React.ReactNode;
}

function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data found",
  className,
  onRowClick,
  renderExpandedRow,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      // Keep numeric columns numeric ("10" should follow "2"), while the
      // collator gives text columns stable, case-insensitive ordering.
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-neutral-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left font-medium text-muted-foreground",
                  col.sortable && "select-none hover:text-foreground",
                  col.className
                )}
                aria-sort={col.sortable ? (sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none") : undefined}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                    onClick={() => handleSort(col.key)}
                    aria-label={`Sort by ${col.header}${sortKey === col.key ? `, currently ${sortDir === "asc" ? "ascending" : "descending"}` : ""}`}
                  >
                    {col.header}
                    {sortKey === col.key && (
                      sortDir === "asc" ? (
                        <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                      )
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-1">{col.header}</div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((item) => (
              <Fragment key={keyExtractor(item)}>
                <tr
                  onClick={() => onRowClick?.(item)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLTableRowElement>) => {
                    if (!onRowClick) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(item);
                    }
                  }}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick ? "Open row details" : undefined}
                  className={cn(
                    "border-b border-border last:border-0",
                    onRowClick &&
                      "cursor-pointer hover:bg-neutral-50 focus:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    renderExpandedRow && "cursor-pointer"
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3", col.className)}>
                      {col.render
                        ? col.render(item)
                        : (item[col.key] as React.ReactNode) ?? "\u2014"}
                    </td>
                  ))}
                </tr>
                {renderExpandedRow?.(item)}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable };
export type { Column };

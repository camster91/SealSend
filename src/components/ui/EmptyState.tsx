"use client";

import Link from "next/link";
import { type LucideIcon, CalendarPlus, Inbox } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-600">{description}</p>
      {(actionHref || onAction) && actionLabel && (
        <div className="mt-6">
          {actionHref ? (
            <Link href={actionHref}>
              <Button className="min-h-11">
                <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button onClick={onAction} className="min-h-11">
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

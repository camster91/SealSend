"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarPlus, ClipboardCheck, MailCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const WELCOME_TOUR_STORAGE_KEY = "sealsend_welcome_tour_v1";

const STEPS = [
  {
    id: "create",
    icon: CalendarPlus,
    title: "Make your invitation",
    description: "Add the date, place and a few words. Upload artwork or pick a template. You get a page you can share with guests.",
  },
  {
    id: "invite",
    icon: MailCheck,
    title: "Invite your guests",
    description: "Add guests one by one or paste a list. Send invitations by email, or by text on an Event Pass.",
  },
  {
    id: "track",
    icon: ClipboardCheck,
    title: "Track replies and check people in",
    description: "See who is coming as replies arrive, send reminders, and check guests in at the door.",
  },
] as const;

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Per-user key, so a second host signing in on the same browser still sees the tour. */
export function welcomeTourStorageKey(userId: string): string {
  return `${WELCOME_TOUR_STORAGE_KEY}:${userId}`;
}

/**
 * A three-step welcome shown once, on the dashboard, to hosts who have no
 * events yet. Dismissal is remembered per user in localStorage; if storage is
 * blocked the tour simply shows again next time.
 */
export function WelcomeTour({ show, userId }: { show: boolean; userId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!show) return;
    let seen = false;
    try {
      seen = localStorage.getItem(welcomeTourStorageKey(userId)) === "done";
    } catch {
      seen = false;
    }
    if (!seen) {
      returnFocusRef.current = document.activeElement;
      setOpen(true);
    }
  }, [show, userId]);

  const close = useCallback(() => {
    try {
      localStorage.setItem(welcomeTourStorageKey(userId), "done");
    } catch {
      // Storage blocked: the tour will show again next visit, which is harmless.
    }
    setOpen(false);
    if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus();
  }, [userId]);

  // Move focus to the main button whenever the step changes.
  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, close]);

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const fade = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.2 } };

  return (
    <div className="fixed inset-0 z-[750] flex items-end justify-center bg-neutral-950/55 p-4 sm:items-center">
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-tour-title"
        aria-describedby="welcome-tour-description"
        initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-white shadow-xl"
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          aria-label="Close welcome tour"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="relative h-36 border-b border-border bg-cotton px-6 py-6 text-ink">
          <AnimatePresence mode="wait">
            <motion.div key={current.id} {...fade} className="flex h-full flex-col justify-end">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-white">
                <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </div>
              <p className="text-sm font-medium text-neutral-600">
                Step {step + 1} of {STEPS.length}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div key={`${current.id}-copy`} {...fade}>
              <h2 id="welcome-tour-title" className="font-display text-3xl text-ink">
                {current.title}
              </h2>
              <p id="welcome-tour-description" className="mt-3 text-sm leading-relaxed text-neutral-600">
                {current.description}
              </p>
              {isLast && (
                <p className="mt-3 text-sm text-neutral-600">
                  Planning events for clients? Add your brand, team and clients in{" "}
                  <Link href="/settings" onClick={close} className="font-medium text-ink underline underline-offset-4 decoration-ink/30 hover:decoration-ink">
                    Settings
                  </Link>
                  .
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center gap-2" aria-hidden>
            {STEPS.map((item, index) => (
              <span key={item.id} className={cn("h-1.5 flex-1 rounded-full", index <= step ? "bg-ink" : "bg-neutral-200")} />
            ))}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={close}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-neutral-600 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              Skip for now
            </button>
            {isLast ? (
              <Link
                href="/events/new"
                ref={(node) => { primaryRef.current = node; }}
                onClick={close}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                Create my first event
              </Link>
            ) : (
              <button
                type="button"
                ref={(node) => { primaryRef.current = node; }}
                onClick={() => setStep((value) => value + 1)}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

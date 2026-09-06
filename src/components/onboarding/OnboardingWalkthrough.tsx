"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, MailCheck, Sparkles, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sealsend_ftue_v1";

const STEPS = [
  {
    id: "create",
    icon: CalendarPlus,
    title: "Create a beautiful invite",
    description:
      "Design your event in minutes — add details, upload artwork, and publish a shareable page guests will love.",
    accent: "from-brand-500 to-brand-700",
  },
  {
    id: "invite",
    icon: MailCheck,
    title: "Invite with email or SMS",
    description:
      "Import your guest list, send invitations in one tap, and track delivery without leaving SealSend.",
    accent: "from-accent-500 to-brand-600",
  },
  {
    id: "rsvp",
    icon: Sparkles,
    title: "Watch RSVPs roll in",
    description:
      "Collect responses, plus-ones, and comments in real time — then export or follow up with reminders.",
    accent: "from-success-500 to-brand-600",
  },
] as const;

interface OnboardingWalkthroughProps {
  forceOpen?: boolean;
  onComplete?: () => void;
}

export function OnboardingWalkthrough({
  forceOpen = false,
  onComplete,
}: OnboardingWalkthroughProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "done") {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [forceOpen]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // ignore
    }
    setOpen(false);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", onKeyDown);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = original;
    };
  }, [open, finish]);

  const next = () => {
    if (step >= STEPS.length - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  };

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[750] flex items-end justify-center bg-neutral-950/55 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ftue-title"
      aria-describedby="ftue-desc"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={finish}
          className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="Skip walkthrough"
        >
          <X className="h-5 w-5" />
        </button>

        <div className={cn("relative h-40 bg-gradient-to-br px-6 py-8 text-white", current.accent)}>
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 20%, white, transparent 45%)",
            }}
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="relative flex h-full flex-col justify-end"
            >
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
                Step {step + 1} of {STEPS.length}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id + "-copy"}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22 }}
            >
              <h2 id="ftue-title" className="text-2xl font-semibold tracking-tight text-neutral-900">
                {current.title}
              </h2>
              <p id="ftue-desc" className="mt-3 text-sm leading-relaxed text-neutral-600">
                {current.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center gap-2" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= step ? "bg-brand-600" : "bg-neutral-200"
                )}
              />
            ))}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={finish}
              className="min-h-11 rounded-xl px-3 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Skip for now
            </button>
            <Button onClick={next} className="min-h-11 min-w-[9rem]">
              {isLast ? "Get started" : "Next"}
              {!isLast && <ArrowRight className="ml-2 h-4 w-4" aria-hidden />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

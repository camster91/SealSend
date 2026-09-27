"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/*
 * App-wide feedback: `useConfirm()` replaces window.confirm() with an
 * accessible dialog, and `useToast()` shows short status messages.
 * Both need <FeedbackProvider> above them (the dashboard layout has one).
 */

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for deletes and anything that can't be undone. */
  tone?: "danger" | "default";
};

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

type FeedbackContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, tone?: ToastTone) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const TOAST_DURATION_MS = 4500;
const TOAST_STYLES: Record<ToastTone, string> = {
  success: "border-success-100 bg-success-50 text-success-700",
  error: "border-error-100 bg-error-50 text-error-600",
  info: "border-brand-100 bg-brand-50 text-brand-700",
};
const TOAST_ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setRequest((current) => {
      current?.resolve(false);
      return { ...options, resolve };
    });
  }), []);

  const answer = useCallback((value: boolean) => {
    setRequest((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((items) => [...items.slice(-2), { id, message, tone }]);
    setTimeout(() => dismiss(id), TOAST_DURATION_MS);
  }, [dismiss]);

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {request && <ConfirmDialog {...request} onAnswer={answer} />}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-16 z-[800] flex flex-col items-center gap-2 p-4 md:bottom-0 sm:items-end"
        aria-live="polite"
      >
        {toasts.map((item) => {
          const Icon = TOAST_ICONS[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg animate-fade-in", TOAST_STYLES[item.tone])}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-sm font-medium">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-my-1 -mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="Dismiss message"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onAnswer,
}: ConfirmOptions & { onAnswer: (value: boolean) => void }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    // Focus the safe choice first.
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onAnswer(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const buttons = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onAnswer]);

  return (
    <div
      className="fixed inset-0 z-[700] flex items-end justify-center bg-neutral-950/50 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onAnswer(false);
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl animate-fade-in"
      >
        <div className="flex items-start gap-4">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", tone === "danger" ? "bg-error-50 text-error-600" : "bg-brand-50 text-brand-600")}>
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-neutral-900">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-neutral-600">{description}</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} type="button" variant="outline" className="min-h-11" onClick={() => onAnswer(false)}>{cancelLabel}</Button>
          <Button type="button" variant={tone === "danger" ? "destructive" : "default"} className="min-h-11" onClick={() => onAnswer(true)}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Falls back to the browser's own confirm/alert when no provider is mounted,
 * so a component used outside the dashboard still works.
 */
export function useConfirm(): FeedbackContextValue["confirm"] {
  const context = useContext(FeedbackContext);
  return context?.confirm ?? (async (options) => window.confirm(options.description ? `${options.title}\n\n${options.description}` : options.title));
}

export function useToast(): FeedbackContextValue["toast"] {
  const context = useContext(FeedbackContext);
  return context?.toast ?? (() => undefined);
}

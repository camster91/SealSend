"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export interface ToastInput {
  title?: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastInput, "description" | "variant" | "duration">> {
  id: string;
  title?: string;
}

interface ToastContextValue {
  toast: (input: ToastInput | string) => void;
  success: (description: string, title?: string) => void;
  error: (description: string, title?: string) => void;
  info: (description: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastVariant, string> = {
  success: "border-success-100 bg-success-50 text-success-700",
  error: "border-error-100 bg-error-50 text-error-600",
  info: "border-brand-100 bg-brand-50 text-brand-700",
};

const ICON_STYLES: Record<ToastVariant, string> = {
  success: "text-success-600",
  error: "text-error-500",
  info: "text-brand-600",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput | string) => {
      const payload: ToastInput = typeof input === "string" ? { description: input } : input;
      const id = crypto.randomUUID();
      const item: ToastItem = {
        id,
        title: payload.title,
        description: payload.description,
        variant: payload.variant ?? "info",
        duration: payload.duration ?? 4200,
      };
      setToasts((prev) => [...prev.slice(-3), item]);
      const timer = setTimeout(() => dismiss(id), item.duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (description, title) => toast({ description, title, variant: "success" }),
      error: (description, title) => toast({ description, title, variant: "error" }),
      info: (description, title) => toast({ description, title, variant: "info" }),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[800] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const Icon = ICONS[item.variant];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm",
                  STYLES[item.variant]
                )}
                role="status"
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ICON_STYLES[item.variant])} aria-hidden />
                <div className="min-w-0 flex-1">
                  {item.title && (
                    <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                  )}
                  <p className={cn("text-sm", item.title ? "text-neutral-600" : "font-medium")}>
                    {item.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

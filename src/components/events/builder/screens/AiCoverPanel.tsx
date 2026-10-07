"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { COVER_STYLES, COVER_FAILED, coverFailureMessage, type CoverStyle } from "@/lib/event-builder/ai-cover";
import type { ScreenContext } from "../BuilderShell";

const BUTTON = "min-h-11 rounded-[10px] px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60";

export function AiCoverPanel({ ctx, onAccepted }: { ctx: ScreenContext; onAccepted?: () => void }) {
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CoverStyle>("elegant");
  const [note, setNote] = useState("");
  // The last good cover stays visible when a later attempt fails.
  const [preview, setPreview] = useState<string>();
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [returnFocus, setReturnFocus] = useState(false);
  const [remaining, setRemaining] = useState<number>();
  const [failed, setFailed] = useState<string>();

  // The count is a convenience: if it can't be read, the line is simply left out.
  useEffect(() => {
    let live = true;
    fetch("/api/ai/cover/allowance")
      .then((res) => (res.ok ? res.json() : undefined))
      .then((json: { remaining?: number } | undefined) => {
        if (live && typeof json?.remaining === "number") setRemaining(json.remaining);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // The opener is unmounted while the panel is open, so focus returns once it is back.
  useEffect(() => {
    if (returnFocus && !open) {
      openerRef.current?.focus();
      setReturnFocus(false);
    }
  }, [returnFocus, open]);

  const generate = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFailed(undefined);
    setWorking(true);
    try {
      const eventId = await ctx.ensureDraft();
      const res = await fetch("/api/ai/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, style, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; remaining?: number; code?: string };
      if (typeof json.remaining === "number") setRemaining(json.remaining);
      if (!res.ok || !json.url) {
        setFailed(coverFailureMessage(res.status, json.code));
        if (res.status === 429) setRemaining(0);
        return;
      }
      setPreview(json.url);
    } catch {
      setFailed(COVER_FAILED);
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  };

  const acceptCover = (url: string) => {
    ctx.update({ design_url: url, design_type: "image" });
    onAccepted?.();
    setPreview(undefined);
    setFailed(undefined);
    setOpen(false);
    setReturnFocus(true);
  };

  const spent = remaining === 0;

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      {!open ? (
        <div className="flex flex-wrap items-center gap-3">
          <button ref={openerRef} type="button" onClick={() => setOpen(true)}
            className={cn(BUTTON, "flex items-center gap-2 border border-border bg-white text-ink")}>
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Generate with AI
          </button>
          {remaining !== undefined && <span className="text-sm text-muted-foreground">{remaining} left today</span>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Generate with AI</h3>
            {remaining !== undefined && <span className="text-sm text-muted-foreground">{remaining} left today</span>}
          </div>
          <div role="group" aria-label="Style" className="flex flex-wrap gap-2">
            {COVER_STYLES.map((s) => (
              <button key={s.value} type="button" aria-pressed={style === s.value} disabled={working}
                onClick={() => setStyle(s.value)}
                className={cn(BUTTON, "border", style === s.value ? "border-ink bg-ink text-white" : "border-border bg-white text-ink")}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <label htmlFor={noteId} className="text-sm font-medium text-ink">Anything else? (e.g. autumn leaves, navy and gold)</label>
            <textarea id={noteId} rows={2} maxLength={300} value={note} disabled={working} onChange={(e) => setNote(e.target.value)}
              className="block min-h-11 w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink" />
          </div>
          {!preview && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void generate()} disabled={working || spent}
                className={cn(BUTTON, "bg-ink text-white")}>
                Generate
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={working}
                className={cn(BUTTON, "text-ink underline underline-offset-4")}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <p aria-live="polite" className={cn("text-sm text-muted-foreground", !working && "sr-only")}>
        {working ? (
          <span className="motion-safe:animate-pulse motion-reduce:animate-none">Making your cover… about 30 seconds</span>
        ) : ""}
      </p>
      <p aria-live="polite" className={cn("text-sm font-medium text-wax", !failed && "sr-only")}>{failed ?? ""}</p>

      {preview && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your AI cover" className="aspect-[4/3] w-full rounded-2xl border border-border object-cover" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => acceptCover(preview)} disabled={working} className={cn(BUTTON, "bg-ink text-white")}>Use this</button>
            <button type="button" onClick={() => void generate()} disabled={working || spent}
              className={cn(BUTTON, "border border-border bg-white text-ink")}>
              Try again ({remaining ?? 0} left)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

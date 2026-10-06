"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";
import type { EventCustomization } from "@/types/database";
import { Field } from "./Field";

const UPLOAD_FAILED = "That file didn't upload. Try a smaller file (max 10 MB for images, 50 MB for video).";
const BUTTON_STYLES = [
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
  { value: "square", label: "Square" },
];

interface MediaPickerProps {
  id: string;
  label: string;
  hint: string;
  value: string | null;
  accept: string;
  kind: "image" | "audio";
  ensureDraft(): Promise<string>;
  onValue(url: string): void;
}

/** One small upload box. A failure shows under it and leaves everything else alone. */
function MediaPicker({ id, label, hint, value, accept, kind, ensureDraft, onValue }: MediaPickerProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setFailed(false);
    try {
      await ensureDraft();
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(kind === "audio" ? "/api/upload?type=audio" : "/api/upload", { method: "POST", body });
      if (!res.ok) throw new Error("upload");
      const json = (await res.json()) as { url?: string };
      if (!json.url) throw new Error("upload");
      onValue(json.url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Field id={id} label={label} hint={hint}>
        {(aria) => (
          <input
            {...aria}
            type="file"
            accept={accept}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
            className="block min-h-11 w-full cursor-pointer rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded-[10px] file:border-0 file:bg-cotton file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
          />
        )}
      </Field>
      {busy && <p className="text-sm text-muted-foreground">Uploading…</p>}
      {value && !busy && (
        <div className="flex flex-wrap items-center gap-3">
          {kind === "audio" ? (
            <audio src={value} controls className="w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="h-16 max-w-full rounded-[10px] border border-border object-contain" />
          )}
          <button
            type="button"
            onClick={() => onValue("")}
            className="min-h-11 rounded-[10px] px-3 text-sm font-medium text-ink underline underline-offset-4"
          >
            {`Remove ${label.toLowerCase()}`}
          </button>
        </div>
      )}
      <p aria-live="polite" className={cn("text-sm font-medium text-wax", !failed && "sr-only")}>
        {failed ? UPLOAD_FAILED : ""}
      </p>
    </div>
  );
}

interface LookMoreOptionsProps {
  customization: EventCustomization;
  ensureDraft(): Promise<string>;
  onChange(changes: Partial<EventCustomization>): void;
}

export function LookMoreOptions({ customization, ensureDraft, onChange }: LookMoreOptionsProps) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-border bg-white">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="look-more"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between rounded-2xl px-5 py-3 text-left text-base font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          More
          <ChevronDown aria-hidden="true" className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      <div id="look-more" hidden={!open} className="space-y-5 border-t border-border px-5 py-5">
        <Toggle
          checked={customization.showCountdown}
          onChange={(v) => onChange({ showCountdown: v })}
          label="Show a countdown"
          description="Counts down the days to your event."
        />
        <Field id="buttonStyle" label="Button style">
          {(aria) => (
            <Select {...aria} className="h-11" value={customization.buttonStyle} options={BUTTON_STYLES}
              onChange={(e) => onChange({ buttonStyle: e.target.value as EventCustomization["buttonStyle"] })} />
          )}
        </Field>
        <MediaPicker id="logoUrl" label="Logo" hint="Shown above your invitation. Max 10 MB." value={customization.logoUrl}
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" kind="image" ensureDraft={ensureDraft}
          onValue={(url) => onChange({ logoUrl: url })} />
        <MediaPicker id="backgroundImage" label="Background image" hint="Fills the page behind your invitation. Max 10 MB." value={customization.backgroundImage}
          accept="image/jpeg,image/png,image/gif,image/webp" kind="image" ensureDraft={ensureDraft}
          onValue={(url) => onChange({ backgroundImage: url })} />
        <MediaPicker id="audioUrl" label="Music" hint="Plays on your event page." value={customization.audioUrl}
          accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4" kind="audio" ensureDraft={ensureDraft}
          onValue={(url) => onChange({ audioUrl: url })} />
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { ImageIcon, Link as LinkIcon, Video } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import { EVENT_TEMPLATES } from "@/lib/event-templates";
import type { EventCustomization } from "@/types/database";
import type { ScreenContext } from "../BuilderShell";
import { Field } from "./Field";
import { LookMoreOptions } from "./LookMoreOptions";

const FONTS = ["Inter", "Poppins", "Georgia", "Courier"].map((f) => ({ value: f, label: f }));
const UPLOAD_FAILED = "That file didn't upload. Try a smaller file (max 10 MB for images, 50 MB for video).";
const LIMITS = "max 10 MB for images, 50 MB for video";
const MODES = [
  { mode: "upload", label: "Upload image", Icon: ImageIcon },
  { mode: "video", label: "Upload video", Icon: Video },
  { mode: "url", label: "Image link", Icon: LinkIcon },
] as const;
type Mode = (typeof MODES)[number]["mode"];

const isVideoUrl = (url: string) => /\.(mp4|webm)$/i.test(url);
const SELECT = "min-h-11";

export function LookScreen({ ctx }: { ctx: ScreenContext }) {
  const { data } = ctx;
  const custom = data.customization;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const mode: Mode = data.design_type === "video" ? "video" : data.design_type === "url" ? "url" : "upload";
  const imageFit = custom.imageFit ?? "contain";
  const imagePosition = custom.imagePosition ?? "center";
  const showVideo = data.design_type === "video" || isVideoUrl(data.design_url);
  const change = (changes: Partial<EventCustomization>) => ctx.update({ customization: { ...custom, ...changes } });

  const upload = async (file: File) => {
    setBusy(true);
    setFailed(false);
    try {
      await ctx.ensureDraft();
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(mode === "video" ? "/api/upload?type=video" : "/api/upload", { method: "POST", body });
      if (!res.ok) throw new Error("upload");
      const json = (await res.json()) as { url?: string };
      if (!json.url) throw new Error("upload");
      ctx.update({ design_url: json.url, design_type: mode === "video" ? "video" : "upload" });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const pickMode = (next: Mode) => {
    setFailed(false);
    ctx.update(data.design_url ? { design_type: next, design_url: "" } : { design_type: next });
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h1 className="font-display text-3xl text-ink">Make it yours</h1>
        <p className="mt-2 text-base text-muted-foreground">Pick a style, add your artwork, and watch the preview change.</p>
      </div>

      <section aria-labelledby="look-styles" className="space-y-3">
        <h2 id="look-styles" className="text-sm font-semibold text-ink">Start from a style</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {EVENT_TEMPLATES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => ctx.update({ customization: { ...custom, ...t.customization } })}
                aria-pressed={custom.primaryColor === t.customization.primaryColor && custom.backgroundColor === t.customization.backgroundColor}
                className="flex min-h-11 w-full flex-col gap-2 rounded-2xl border border-border bg-white p-3 text-left aria-pressed:border-ink aria-pressed:ring-2 aria-pressed:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                <span aria-hidden="true" className="flex h-8 overflow-hidden rounded-[10px] border border-border">
                  <span className="flex-1" style={{ backgroundColor: t.customization.backgroundColor }} />
                  <span className="w-1/3" style={{ backgroundColor: t.customization.primaryColor }} />
                </span>
                <span className="text-sm font-medium text-ink">{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="look-colours" className="space-y-5 rounded-2xl border border-border bg-white p-5">
        <h2 id="look-colours" className="text-sm font-semibold text-ink">Colours and font</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {(["primaryColor", "backgroundColor"] as const).map((key) => (
            <Field key={key} id={key} label={key === "primaryColor" ? "Main colour" : "Background colour"}>
              {(aria) => (
                <div className="flex items-center gap-3">
                  <input {...aria} type="color" value={custom[key]} onChange={(e) => change({ [key]: e.target.value })}
                    className="h-11 w-14 cursor-pointer rounded-[10px] border border-border bg-white p-1" />
                  <span className="text-sm text-muted-foreground">{custom[key].toUpperCase()}</span>
                </div>
              )}
            </Field>
          ))}
        </div>
        <Field id="fontFamily" label="Font">
          {(aria) => <Select {...aria} className={SELECT} value={custom.fontFamily} options={FONTS} onChange={(e) => change({ fontFamily: e.target.value })} />}
        </Field>
      </section>

      <section aria-labelledby="look-cover" className="space-y-4 rounded-2xl border border-border bg-white p-5">
        <h2 id="look-cover" className="text-sm font-semibold text-ink">Your artwork</h2>
        <div className="flex flex-wrap gap-2">
          {MODES.map(({ mode: m, label, Icon }) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => pickMode(m)}
              className={cn("flex min-h-11 items-center gap-2 rounded-[10px] border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
                mode === m ? "border-ink bg-ink text-white" : "border-border bg-white text-ink")}>
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {mode === "url" ? (
          <Field id="design_url" label="Image link">
            {(aria) => <Input {...aria} type="url" className="h-11" value={data.design_url} placeholder="https://example.com/your-design.png"
              onChange={(e) => ctx.update({ design_url: e.target.value, design_type: "url" })} />}
          </Field>
        ) : (
          <Field id="design_file" label={mode === "video" ? "Video file" : "Image file"} hint={`MP4 or WebM for video, JPEG, PNG, GIF or WebP for images. ${LIMITS}`}>
            {(aria) => (
              <input {...aria} type="file" disabled={busy}
                accept={mode === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/gif,image/webp"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
                className="block min-h-11 w-full cursor-pointer rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded-[10px] file:border-0 file:bg-cotton file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink" />
            )}
          </Field>
        )}
        {busy && <p className="text-sm text-muted-foreground">Uploading…</p>}
        <p aria-live="polite" className={cn("text-sm font-medium text-wax", !failed && "sr-only")}>{failed ? UPLOAD_FAILED : ""}</p>

        {data.design_url && (
          <div className="space-y-3">
            {showVideo ? (
              <video src={data.design_url} controls className="h-auto max-h-80 w-full rounded-2xl border border-border" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.design_url} alt="Your artwork" style={{ objectPosition: imagePosition }}
                className={cn("aspect-[4/3] w-full rounded-2xl border border-border", imageFit === "cover" ? "object-cover" : "object-contain")} />
            )}
            <button type="button" onClick={() => ctx.update({ design_url: "", design_type: "upload" })}
              className="min-h-11 rounded-[10px] px-3 text-sm font-medium text-ink underline underline-offset-4">
              Remove artwork
            </button>
          </div>
        )}

        {!showVideo && (
          <fieldset className="rounded-2xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold text-ink">Artwork crop and focus</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="imageFit" label="Fit">
                {(aria) => <Select {...aria} className={SELECT} value={imageFit} onChange={(e) => change({ imageFit: e.target.value as "contain" | "cover" })}
                  options={[{ value: "contain", label: "Show complete artwork" }, { value: "cover", label: "Fill and crop" }]} />}
              </Field>
              <Field id="imagePosition" label="Focus">
                {(aria) => <Select {...aria} className={SELECT} value={imagePosition} onChange={(e) => change({ imagePosition: e.target.value as "top" | "center" | "bottom" })}
                  options={[{ value: "top", label: "Top" }, { value: "center", label: "Centre" }, { value: "bottom", label: "Bottom" }]} />}
              </Field>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">This changes how it looks only. SealSend keeps the uploaded original.</p>
          </fieldset>
        )}
        <p className="text-sm text-muted-foreground">You can skip this and add artwork later.</p>
      </section>

      <LookMoreOptions customization={custom} ensureDraft={ctx.ensureDraft} onChange={change} />
    </div>
  );
}

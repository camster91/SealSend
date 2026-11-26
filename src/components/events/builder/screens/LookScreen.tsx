"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Link as LinkIcon, Video } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import { EVENT_TEMPLATES } from "@/lib/event-templates";
import { eventDisplayFontFamily } from "@/lib/event-font";
import { checkLink, normalizeLink, storedLinkProblem } from "@/lib/event-builder/field-checks";
import { applyStyle, uploadFailureMessage } from "@/lib/event-builder/look";
import type { EventCustomization, EventLayoutStyle, EventMotif } from "@/types/database";
import type { ScreenContext } from "../BuilderShell";
import { AiCoverPanel } from "./AiCoverPanel";
import { Field } from "./Field";
import { LookMoreOptions } from "./LookMoreOptions";

const FONTS = [
  "Inter",
  "DM Sans",
  "Poppins",
  "Cormorant Garamond",
  "Playfair Display",
  "Fraunces",
  "Libre Caslon Display",
  "Georgia",
  "Courier",
].map((f) => ({ value: f, label: f }));
const LAYOUTS: { value: EventLayoutStyle; label: string }[] = [
  { value: "classic", label: "Classic stationery" },
  { value: "editorial", label: "Editorial" },
  { value: "arch", label: "Arched frame" },
  { value: "minimal", label: "Minimal" },
];
const MOTIFS: { value: EventMotif; label: string }[] = [
  { value: "none", label: "None" },
  { value: "botanical", label: "Botanical" },
  { value: "monogram", label: "Monogram crest" },
  { value: "celestial", label: "Celestial star" },
  { value: "frame", label: "Diamond hairline" },
];
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
  const [failed, setFailed] = useState<string>();
  // A half-typed or non-https image link stays here, with an error, until it is one the server accepts.
  const [typedLink, setTypedLink] = useState<string>();
  const mode: Mode = data.design_type === "video" ? "video" : data.design_type === "url" ? "url" : "upload";
  // A link already stored on the event that the server would refuse (for example ftp:) is flagged the same way.
  const linkError = typedLink !== undefined
    ? checkLink(typedLink)
    : mode === "url" ? storedLinkProblem(data.design_url) : undefined;
  const imageFit = custom.imageFit ?? "contain";
  const imagePosition = custom.imagePosition ?? "center";
  const showVideo = data.design_type === "video" || isVideoUrl(data.design_url);
  const change = (changes: Partial<EventCustomization>) => ctx.update({ customization: { ...custom, ...changes } });

  // Leaving now would lose the held link, so lock the steps until it is fixed or cleared.
  const { setBlocking } = ctx;
  const blocking = linkError !== undefined;
  useEffect(() => {
    setBlocking(blocking);
  }, [blocking, setBlocking]);
  useEffect(() => () => setBlocking(false), [setBlocking]);

  const typeLink = (raw: string) => {
    const value = normalizeLink(raw); // spaces only means cleared
    if (checkLink(value)) {
      setTypedLink(value);
      return;
    }
    setTypedLink(undefined);
    ctx.update({ design_url: value, design_type: "url" });
  };

  const upload = async (file: File) => {
    setBusy(true);
    setFailed(undefined);
    try {
      await ctx.ensureDraft();
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(mode === "video" ? "/api/upload?type=video" : "/api/upload", { method: "POST", body });
      if (!res.ok) {
        setFailed(uploadFailureMessage(res.status));
        return;
      }
      const json = (await res.json()) as { url?: string };
      if (!json.url) throw new Error("upload");
      ctx.update({ design_url: json.url, design_type: mode === "video" ? "video" : "upload" });
    } catch {
      setFailed(uploadFailureMessage(undefined));
    } finally {
      setBusy(false);
    }
  };

  const pickMode = (next: Mode) => {
    setFailed(undefined);
    setTypedLink(undefined);
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
          {EVENT_TEMPLATES.map((t) => {
            const isSelected = custom.themeId
              ? custom.themeId === t.id
              : custom.primaryColor === t.customization.primaryColor && custom.backgroundColor === t.customization.backgroundColor;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => ctx.update({ customization: applyStyle(custom, t.customization) })}
                  aria-pressed={isSelected}
                  className="flex min-h-11 w-full flex-col gap-2 rounded-2xl border border-border bg-white p-3 text-left aria-pressed:border-ink aria-pressed:ring-2 aria-pressed:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-12 items-center justify-between overflow-hidden rounded-[10px] border border-border px-3"
                    style={{ backgroundColor: t.customization.backgroundColor }}
                  >
                    <span
                      className="text-lg font-semibold leading-none"
                      style={{
                        color: t.customization.primaryColor,
                        fontFamily: eventDisplayFontFamily(t.customization.displayFont, t.customization.fontFamily),
                      }}
                    >
                      Aa
                    </span>
                    <span
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: t.customization.primaryColor }}
                    />
                  </span>
                  <span className="text-sm font-medium text-ink">{t.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="look-colours" className="space-y-5 rounded-2xl border border-border bg-white p-5">
        <h2 id="look-colours" className="text-sm font-semibold text-ink">Colours and font</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {(["primaryColor", "backgroundColor"] as const).map((key) => (
            <Field key={key} id={key} label={key === "primaryColor" ? "Main colour" : "Background colour"}>
              {(aria) => (
                <div className="flex items-center gap-3">
                  <input {...aria} type="color" value={custom[key]} onChange={(e) => change({ [key]: e.target.value, themeId: undefined })}
                    className="h-11 w-14 cursor-pointer rounded-[10px] border border-border bg-white p-1" />
                  <span className="text-sm text-muted-foreground">{custom[key].toUpperCase()}</span>
                </div>
              )}
            </Field>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="displayFont" label="Heading font">
            {(aria) => (
              <Select
                {...aria}
                className={SELECT}
                value={custom.displayFont ?? custom.fontFamily}
                options={FONTS}
                onChange={(e) => change({ displayFont: e.target.value })}
              />
            )}
          </Field>
          <Field id="fontFamily" label="Body font">
            {(aria) => <Select {...aria} className={SELECT} value={custom.fontFamily} options={FONTS} onChange={(e) => change({ fontFamily: e.target.value })} />}
          </Field>
          <Field id="layoutStyle" label="Layout style">
            {(aria) => (
              <Select
                {...aria}
                className={SELECT}
                value={custom.layoutStyle ?? "classic"}
                options={LAYOUTS}
                onChange={(e) => change({ layoutStyle: e.target.value as EventLayoutStyle })}
              />
            )}
          </Field>
          <Field id="motif" label="Stationery accent">
            {(aria) => (
              <Select
                {...aria}
                className={SELECT}
                value={custom.motif ?? "none"}
                options={MOTIFS}
                onChange={(e) => change({ motif: e.target.value as EventMotif })}
              />
            )}
          </Field>
        </div>
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
          <Field id="design_url" label="Image link" error={linkError}>
            {(aria) => <Input {...aria} type="url" className="h-11" value={typedLink ?? data.design_url} placeholder="https://example.com/your-design.png"
              onChange={(e) => typeLink(e.target.value)} />}
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
        <p aria-live="polite" className={cn("text-sm font-medium text-wax", !failed && "sr-only")}>{failed ?? ""}</p>

        {data.design_url && (
          <div className="space-y-3">
            {showVideo ? (
              <video src={data.design_url} controls className="h-auto max-h-80 w-full rounded-2xl border border-border" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.design_url} alt="Your artwork" style={{ objectPosition: imagePosition }}
                className={cn("aspect-[4/3] w-full rounded-2xl border border-border", imageFit === "cover" ? "object-cover" : "object-contain")} />
            )}
            <button type="button" onClick={() => { setTypedLink(undefined); ctx.update({ design_url: "", design_type: "upload" }); }}
              className="min-h-11 rounded-[10px] px-3 text-sm font-medium text-ink underline underline-offset-4">
              Remove artwork
            </button>
          </div>
        )}

        {ctx.aiCoverEnabled && <AiCoverPanel ctx={ctx} onAccepted={() => setTypedLink(undefined)} />}

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

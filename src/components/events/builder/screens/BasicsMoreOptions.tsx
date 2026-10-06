"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";
import { checkRegistryLink, REGISTRY_LABEL_MAX, TEXT_LIMITS } from "@/lib/event-builder/field-checks";
import type { BuilderData } from "@/lib/event-builder/schema";
import { Field } from "./Field";

const DRESS_CODES = ["Casual", "Smart casual", "Business casual", "Semi-formal", "Cocktail", "Black tie", "Festive or theme"];
const CONTROL = "h-11";

interface NumberFieldProps {
  id: string;
  label: string;
  value: number | null;
  placeholder: string;
  min: number;
  max: number;
  error?: string;
  onValue: (value: number | null) => void;
}

/** Keeps what the host typed, so clearing the box does not snap back to a number. */
function NumberField({ id, label, value, placeholder, min, max, error, onValue }: NumberFieldProps) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <Field id={id} label={label} error={error}>
      {(aria) => (
        <Input
          {...aria}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          className={CONTROL}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number.parseInt(e.target.value, 10);
            if (e.target.value === "") onValue(null);
            else if (Number.isFinite(n) && n >= min && n <= max) onValue(n);
          }}
        />
      )}
    </Field>
  );
}

interface MoreOptionsProps {
  view: BuilderData;
  errorFor(field: keyof BuilderData): string | undefined;
  set(patch: Partial<BuilderData>): void;
  /** Writes straight to the draft; used for fields that Basics never holds back. */
  update(patch: Partial<BuilderData>): void;
}

export function BasicsMoreOptions({ view, errorFor, set, update }: MoreOptionsProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [registryError, setRegistryError] = useState("");

  const addRegistry = () => {
    // The server only takes https links, names up to 100 characters and 10 links.
    const problem = checkRegistryLink(label, url, view.registry_links.length);
    if (problem) return setRegistryError(problem);
    setRegistryError("");
    update({ registry_links: [...view.registry_links, { label: label.trim(), url: url.trim() }] });
    setLabel("");
    setUrl("");
  };

  return (
    <section className="rounded-2xl border border-border bg-white">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="basics-more"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between rounded-2xl px-5 py-3 text-left text-base font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          More options
          <ChevronDown aria-hidden="true" className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      <div id="basics-more" hidden={!open} className="space-y-5 border-t border-border px-5 py-5">
        <Field
          id="description"
          label="About the event"
          error={errorFor("description")}
          aside={<span className="text-xs text-muted-foreground">{`${view.description.length}/2000`}</span>}
        >
          {(aria) => (
            <Textarea {...aria} rows={3} maxLength={TEXT_LIMITS.description} value={view.description} placeholder="Tell guests what to expect."
              onChange={(e) => set({ description: e.target.value })} />
          )}
        </Field>
        <Field id="host_name" label="Hosted by" error={errorFor("host_name")}>
          {(aria) => (
            <Input {...aria} className={CONTROL} maxLength={TEXT_LIMITS.host_name} value={view.host_name} placeholder="For example, Sarah and Tom"
              onChange={(e) => set({ host_name: e.target.value })} />
          )}
        </Field>
        <Field id="dress_code" label="Dress code" error={errorFor("dress_code")}>
          {(aria) => (
            <Select {...aria} className={CONTROL} value={view.dress_code} onChange={(e) => set({ dress_code: e.target.value })}
              options={[{ value: "", label: "No dress code" }, ...DRESS_CODES.map((c) => ({ value: c, label: c }))]} />
          )}
        </Field>
        <Field id="rsvp_deadline" label="Reply by" error={errorFor("rsvp_deadline")} hint="After this, guests can no longer reply.">
          {(aria) => (
            <Input {...aria} type="datetime-local" className={CONTROL} value={view.rsvp_deadline}
              onChange={(e) => set({ rsvp_deadline: e.target.value })} />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField id="max_attendees" label="Most guests that can come" value={view.max_attendees} placeholder="No limit"
            min={1} max={10000} error={errorFor("max_attendees")} onValue={(n) => set({ max_attendees: n })} />
          <NumberField id="max_guests_per_rsvp" label="Most people per reply" value={view.max_guests_per_rsvp} placeholder="10"
            min={1} max={50} error={errorFor("max_guests_per_rsvp")} onValue={(n) => set({ max_guests_per_rsvp: n ?? 10 })} />
        </div>
        <Toggle checked={view.allow_plus_ones} onChange={(v) => set({ allow_plus_ones: v })} label="Guests can bring a plus-one"
          description="Lets guests add other people to their reply." />

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink">Gift registries</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
            <div>
              <label htmlFor="registry-label" className="sr-only">Registry name</label>
              <Input id="registry-label" className={CONTROL} maxLength={REGISTRY_LABEL_MAX} value={label} placeholder="Name, such as Amazon"
                onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <label htmlFor="registry-url" className="sr-only">Registry web address</label>
              <Input id="registry-url" type="url" className={CONTROL} value={url} placeholder="https://"
                aria-describedby={registryError ? "registry-error" : undefined} aria-invalid={registryError ? true : undefined}
                onChange={(e) => setUrl(e.target.value)} />
            </div>
            <Button type="button" variant="outline" size="lg" onClick={addRegistry}>Add link</Button>
          </div>
          {registryError && <p id="registry-error" role="alert" className="text-sm font-medium text-wax">{registryError}</p>}
          {view.registry_links.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {view.registry_links.map((link, i) => (
                <li key={`${link.url}-${i}`} className="flex items-center justify-between gap-2 px-4 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{link.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{link.url}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${link.label}`}
                    onClick={() => update({ registry_links: view.registry_links.filter((_, j) => j !== i) })}>
                    <X aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>
    </section>
  );
}

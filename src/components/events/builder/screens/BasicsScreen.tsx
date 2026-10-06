"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { basicsErrors, resolveHeld } from "@/lib/event-builder/basics-validation";
import { TEXT_LIMITS } from "@/lib/event-builder/field-checks";
import type { BuilderData } from "@/lib/event-builder/schema";
import type { ScreenContext } from "../BuilderShell";
import { BasicsMoreOptions } from "./BasicsMoreOptions";
import { Field } from "./Field";

const CONTROL = "h-11";

function timezoneOptions(current: string) {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones.map((zone) => ({ value: zone, label: zone.replace(/_/g, " ") }));
}

export function BasicsScreen({ ctx }: { ctx: ScreenContext }) {
  const { data, published, mode } = ctx;
  // A value the server would refuse (or a published event must not have) is kept here and not sent.
  const [held, setHeld] = useState<Partial<BuilderData>>({});
  const view: BuilderData = { ...data, ...held };
  // Once the draft exists, a cleared name is held here: the server refuses a blank one.
  const holdBlankName = Boolean(ctx.eventId);
  const errors = basicsErrors(view, held, { published, holdBlankName });
  const zones = useMemo(() => timezoneOptions(data.event_timezone), [data.event_timezone]);

  const errorFor = (field: keyof BuilderData): string | undefined =>
    errors[field] ?? ctx.fieldErrors[field] ?? (field === "title" && !view.title.trim() ? ctx.nameError : undefined);

  const set = (patch: Partial<BuilderData>) => {
    const result = resolveHeld(data, held, patch, published, { holdBlankName });
    setHeld(result.held);
    if (Object.keys(result.send).length > 0) ctx.update(result.send);
  };

  // Tell the shell to lock navigation while a held value would be lost by leaving.
  const blocking = Object.keys(held).length > 0;
  const { setBlocking } = ctx;
  useEffect(() => {
    setBlocking(blocking);
  }, [blocking, setBlocking]);
  useEffect(() => () => setBlocking(false), [setBlocking]);

  const ensureNamed = () => {
    if (mode === "create" && !ctx.eventId && data.title.trim()) ctx.ensureDraft().catch(() => undefined);
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h1 className="font-display text-3xl text-ink">When and where?</h1>
        <p className="mt-2 text-base text-muted-foreground">Start with the basics. You can change them any time.</p>
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-white p-5">
        <Field
          id="title"
          label="Name of your event"
          error={errorFor("title")}
          aside={<span aria-live="polite" className="text-xs text-muted-foreground">{`${view.title.length}/200`}</span>}
        >
          {(aria) => (
            <Input {...aria} className={CONTROL} maxLength={TEXT_LIMITS.title} value={view.title} placeholder="For example, Sarah and Tom's wedding"
              onChange={(e) => set({ title: e.target.value })} onBlur={ensureNamed} />
          )}
        </Field>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-ink">When</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="event_date" label="Starts" error={errorFor("event_date")}>
              {(aria) => (
                <Input {...aria} type="datetime-local" className={CONTROL} value={view.event_date}
                  onChange={(e) => set({ event_date: e.target.value })} />
              )}
            </Field>
            <Field id="event_end_date" label="Ends (optional)" error={errorFor("event_end_date")}>
              {(aria) => (
                <Input {...aria} type="datetime-local" className={CONTROL} value={view.event_end_date}
                  onChange={(e) => set({ event_end_date: e.target.value })} />
              )}
            </Field>
          </div>
          <Field id="event_timezone" label="Time zone" error={errorFor("event_timezone")}>
            {(aria) => (
              <Select {...aria} className={CONTROL} value={view.event_timezone} options={zones}
                onChange={(e) => set({ event_timezone: e.target.value })} />
            )}
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-ink">Where</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="location_name" label="Place name" error={errorFor("location_name")}>
              {(aria) => (
                <Input {...aria} className={CONTROL} maxLength={TEXT_LIMITS.location_name} value={view.location_name} placeholder="For example, The Grand Hall"
                  onChange={(e) => set({ location_name: e.target.value })} />
              )}
            </Field>
            <Field id="location_address" label="Address" error={errorFor("location_address")}>
              {(aria) => (
                <Input {...aria} className={CONTROL} maxLength={TEXT_LIMITS.location_address} value={view.location_address} placeholder="123 Main St, Toronto"
                  onChange={(e) => set({ location_address: e.target.value })} />
              )}
            </Field>
          </div>
        </fieldset>
      </div>

      <BasicsMoreOptions view={view} errorFor={errorFor} set={set} update={ctx.update} />
    </div>
  );
}

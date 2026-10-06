"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { defaultInvitationCopy } from "@/lib/invitation-defaults";
import { getPublicationReadiness, type PublicationBlocker } from "@/lib/publication-readiness";
import { builderDataToPreviewEvent } from "@/lib/event-builder/mapping";
import { buildReadinessCandidate, createRsvpSaver, describePublishError, prepareRsvpFields, primaryAction, RSVP_SAVE_FAILED } from "@/lib/event-builder/review";
import type { BuilderRsvpField } from "@/lib/event-builder/schema";
import type { ScreenContext } from "../BuilderShell";
import { PublishedCelebration } from "../PublishedCelebration";
import { Field } from "./Field";

const BUTTON = "inline-flex min-h-11 items-center justify-center rounded-[10px] px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60";
const CONTROL = "h-11 rounded-[10px]";
const SAVE_FAILED = "Something went wrong, so your changes were not saved. Please try again.";

export function ReviewScreen({ ctx }: { ctx: ScreenContext }) {
  const router = useRouter();
  const { data } = ctx;
  const ctxRef = useRef(ctx);
  useEffect(() => {
    ctxRef.current = ctx;
  });
  const [rsvpError, setRsvpError] = useState<string>();
  const [saver] = useState(() =>
    createRsvpSaver({
      sleep: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
      onError: setRsvpError,
      send: async (fields) => {
        const prepared = prepareRsvpFields(fields);
        if (prepared.problem) return prepared.problem;
        try {
          const id = await ctxRef.current.ensureDraft();
          const res = await fetch(`/api/events/${id}/rsvp-fields`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(prepared.fields),
          });
          return res.ok ? undefined : RSVP_SAVE_FAILED;
        } catch {
          return RSVP_SAVE_FAILED;
        }
      },
    }),
  );
  // Leaving the screen sends any edit still waiting.
  useEffect(() => () => void saver.flush(), [saver]);
  const [busy, setBusy] = useState<"publish" | "draft" | "save" | undefined>();
  const [serverBlockers, setServerBlockers] = useState<PublicationBlocker[]>([]);
  const [error, setError] = useState<string>();
  const [live, setLive] = useState<{ id: string; slug: string }>();

  const action = primaryAction({ published: ctx.published });
  const readiness = getPublicationReadiness(buildReadinessCandidate(data));
  const blockers = readiness.blockers.length > 0 ? readiness.blockers : serverBlockers;
  const placeholders = defaultInvitationCopy(builderDataToPreviewEvent(data));

  const setField = (index: number, patch: Partial<BuilderRsvpField>) => {
    const next = data.rsvp_fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    ctx.update({ rsvp_fields: next });
    saver.schedule(next);
  };

  /** Saves the draft, then the question list when it changed. Returns the event id. */
  const saveEverything = async (): Promise<string> => {
    await ctx.flush();
    const failure = await saver.flush();
    if (failure) throw new Error(failure);
    const id = await ctx.ensureDraft();
    return id;
  };

  const run = async (kind: "publish" | "draft" | "save", work: (id: string) => Promise<void>) => {
    setBusy(kind);
    setError(undefined);
    try {
      await work(await saveEverything());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : SAVE_FAILED);
    } finally {
      setBusy(undefined);
    }
  };

  const publish = () =>
    run("publish", async (id) => {
      // The route toggles status, so a published event must never reach it.
      if (!action.callsPublish) return;
      const res = await fetch(`/api/events/${id}/publish`, { method: "POST" });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const failure = describePublishError(res.status, body);
        setServerBlockers(failure.blockers);
        if (failure.message) setError(failure.message);
        return;
      }
      const slug = (body as { slug?: string } | null)?.slug;
      if (!slug) throw new Error(SAVE_FAILED);
      ctx.markPublished();
      setLive({ id, slug });
    });

  const saveChanges = () => run("save", async (id) => router.push(`/events/${id}`));
  const saveDraft = () => run("draft", async (id) => router.push(`/events/${id}`));

  if (live) return <PublishedCelebration eventId={live.id} slug={live.slug} />;

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h1 className="font-display text-3xl text-ink">Ready to send?</h1>
        <p className="mt-2 text-base text-muted-foreground">Check what guests will see, then make your invite live.</p>
      </div>

      <section aria-labelledby="review-copy" className="space-y-4 rounded-2xl border border-border bg-white p-4 sm:p-5">
        <h2 id="review-copy" className="text-sm font-semibold text-ink">What your invitation says</h2>
        <Field id="review-headline" label="Headline" hint="Leave it blank to use the one shown.">
          {(aria) => (
            <Input {...aria} className={CONTROL} value={data.invitation_headline} placeholder={placeholders.headline} onChange={(e) => ctx.update({ invitation_headline: e.target.value })} />
          )}
        </Field>
        <Field id="review-body" label="Message" hint="Leave it blank to use the one shown.">
          {(aria) => (
            <textarea
              {...aria}
              rows={4}
              value={data.invitation_body}
              placeholder={placeholders.body}
              onChange={(e) => ctx.update({ invitation_body: e.target.value })}
              className="w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
            />
          )}
        </Field>
      </section>

      <section aria-labelledby="review-questions" className="space-y-4 rounded-2xl border border-border bg-white p-4 sm:p-5">
        <h2 id="review-questions" className="text-sm font-semibold text-ink">Questions to ask guests</h2>
        {data.rsvp_fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">Guests will be asked if they can come.</p>
        ) : (
          <ul className="space-y-4">
            {data.rsvp_fields.map((f, i) => (
              <li key={`${f.field_name}-${i}`} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
                <div className="min-w-0 flex-1">
                  <Field id={`review-q-${i}`} label="Question">
                    {(aria) => <Input {...aria} className={CONTROL} value={f.field_label} onChange={(e) => setField(i, { field_label: e.target.value })} />}
                  </Field>
                </div>
                <Toggle
                  className="min-h-11"
                  checked={f.is_enabled}
                  disabled={f.field_type === "attendance"}
                  label={f.field_type === "attendance" ? "Always asked" : f.is_enabled ? "Asked" : "Not asked"}
                  onChange={(checked) => setField(i, { is_enabled: checked })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="review-must" className="space-y-3 rounded-2xl border border-border bg-white p-4 sm:p-5">
        <h2 id="review-must" className="text-sm font-semibold text-ink">Must-haves</h2>
        {blockers.length === 0 ? (
          <p className="text-sm text-ink">Everything you need is filled in.</p>
        ) : (
          <ul className="space-y-1">
            {blockers.map((b) => (
              <li key={b.field}>
                <button
                  type="button"
                  onClick={() => ctx.goTo("basics")}
                  className="min-h-11 text-left text-sm text-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  {b.message}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rsvpError && <p role="alert" className="text-sm font-medium text-wax">{rsvpError}</p>}
      {error && <p role="alert" className="text-sm font-medium text-wax">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {action.kind === "publish" ? (
          <>
            <button type="button" disabled={busy !== undefined || !readiness.ready} onClick={() => void publish()} className={`${BUTTON} bg-ink text-white`}>
              {busy === "publish" ? "Publishing..." : action.label}
            </button>
            <button type="button" disabled={busy !== undefined} onClick={() => void saveDraft()} className={`${BUTTON} border border-ink bg-white text-ink`}>
              {busy === "draft" ? "Saving..." : "Save as draft"}
            </button>
          </>
        ) : (
          <button type="button" disabled={busy !== undefined} onClick={() => void saveChanges()} className={`${BUTTON} bg-ink text-white`}>
            {busy === "save" ? "Saving..." : action.label}
          </button>
        )}
      </div>
    </div>
  );
}

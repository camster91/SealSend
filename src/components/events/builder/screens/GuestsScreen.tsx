"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { parseGuestCsv } from "@/lib/guest-import";
import { describeBulkResult, guestsAddedLabel } from "@/lib/event-builder/guests";
import type { ScreenContext } from "../BuilderShell";
import { Field } from "./Field";

interface SavedGuest {
  id: string;
  name: string;
  email: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BUTTON = "inline-flex min-h-11 items-center justify-center rounded-[10px] px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60";
const CONTROL = "h-11 rounded-[10px]";

export function GuestsScreen({ ctx }: { ctx: ScreenContext }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [addedNow, setAddedNow] = useState(0);
  const [guests, setGuests] = useState<SavedGuest[]>([]);
  const [busy, setBusy] = useState(false);

  const eventId = ctx.eventId;

  const refresh = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}/guests`);
      if (!res.ok) return;
      const list = (await res.json()) as SavedGuest[];
      if (Array.isArray(list)) setGuests(list);
    } catch {
      // The list is a convenience. A failed refresh must not block adding.
    }
  }, []);

  useEffect(() => {
    if (eventId) void refresh(eventId);
  }, [eventId, refresh]);

  /** Sends guests to the bulk route. Returns an error in words, or undefined when it worked. */
  const send = async (list: Array<{ name: string; email: string }>): Promise<string | undefined> => {
    setBusy(true);
    setNotice(undefined);
    try {
      const id = await ctx.ensureDraft();
      const res = await fetch(`/api/events/${id}/guests/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(list),
      });
      const body: unknown = await res.json().catch(() => null);
      const result = describeBulkResult(res.status, body);
      if (result.error) return result.error;
      setAddedNow((n) => n + result.added);
      setNotice(result.notice);
      await refresh(id);
      return undefined;
    } catch {
      return describeBulkResult(0, null).error;
    } finally {
      setBusy(false);
    }
  };

  const addOne = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const nextNameError = cleanName ? undefined : "Add the guest's name.";
    const nextEmailError = cleanEmail && !EMAIL.test(cleanEmail) ? "That email doesn't look right. Check it or leave it blank." : undefined;
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    if (nextNameError || nextEmailError) return;
    const error = await send([{ name: cleanName, email: cleanEmail }]);
    if (error) {
      setNameError(error);
      return;
    }
    setName("");
    setEmail("");
  };

  const addPasted = async () => {
    setPasteError(undefined);
    const { guests: parsed, issues } = parseGuestCsv(pasted);
    if (parsed.length === 0) {
      setPasteError(issues[0] ? `Line ${issues[0].row}: ${issues[0].message}` : "Paste at least one guest first.");
      return;
    }
    const error = await send(parsed);
    if (error) {
      setPasteError(error);
      return;
    }
    setPasteError(
      issues.length > 0
        ? `${issues.length} ${issues.length === 1 ? "line was" : "lines were"} skipped. Line ${issues[0].row}: ${issues[0].message}`
        : undefined,
    );
    setPasted("");
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h1 className="font-display text-3xl text-ink">{"Who's coming?"}</h1>
        <p className="mt-2 text-base text-muted-foreground">Add your guests now, or skip this and do it later. You can send invitations after you publish.</p>
      </div>

      <section aria-labelledby="guests-add" className="space-y-4 rounded-2xl border border-border bg-white p-4 sm:p-5">
        <h2 id="guests-add" className="text-sm font-semibold text-ink">Add one guest</h2>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void addOne();
          }}
        >
          <Field id="guest-name" label="Name" error={nameError}>
            {(aria) => <Input {...aria} className={CONTROL} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />}
          </Field>
          <Field id="guest-email" label="Email (optional)" error={emailError}>
            {(aria) => <Input {...aria} type="email" className={CONTROL} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}
          </Field>
          <button type="submit" disabled={busy} className={`${BUTTON} bg-ink text-white`}>Add guest</button>
        </form>
      </section>

      <section aria-labelledby="guests-paste" className="space-y-4 rounded-2xl border border-border bg-white p-4 sm:p-5">
        <h2 id="guests-paste" className="text-sm font-semibold text-ink">Add many at once</h2>
        <Field id="guest-paste" label="Paste a list (one guest per line, or name, email)" error={pasteError}>
          {(aria) => (
            <textarea
              {...aria}
              rows={5}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              className="w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
            />
          )}
        </Field>
        <button type="button" disabled={busy} onClick={() => void addPasted()} className={`${BUTTON} border border-ink bg-white text-ink`}>Add these guests</button>
      </section>

      <div aria-live="polite" className="space-y-1 text-sm text-ink">
        {addedNow > 0 && <p className="font-medium">{guestsAddedLabel(addedNow)}</p>}
        {notice && <p className="text-muted-foreground">{notice}</p>}
      </div>

      {guests.length > 0 && (
        <section aria-labelledby="guests-list" className="space-y-3">
          <h2 id="guests-list" className="text-sm font-semibold text-ink">Your guest list ({guests.length})</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {guests.map((g) => (
              <li key={g.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="min-w-0 break-words text-sm font-medium text-ink">{g.name}</span>
                <span className="min-w-0 break-all text-sm text-muted-foreground">{g.email ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={() => ctx.goTo("review")} className={`${BUTTON} border border-ink bg-white text-ink`}>Add guests later</button>
        {eventId && (
          <Link href={`/events/${eventId}/guests`} className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
            Manage guests later on the event page
          </Link>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { formatDateTime } from "@/lib/utils";
import { instantToZonedLocalDateTime, zonedLocalDateTimeToInstant } from "@/lib/datetime";
import type { HostSubEvent, SubEventVisibility } from "@/lib/sub-event-types";

interface GuestOption {
  id: string;
  name: string;
}

interface Draft {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  location_name: string;
  location_address: string;
  visibility: SubEventVisibility;
  invited_guest_ids: string[];
}

const EMPTY: Draft = {
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  location_name: "",
  location_address: "",
  visibility: "all",
  invited_guest_ids: [],
};

function toLocal(value: string | null, timezone: string): string {
  if (!value) return "";
  try {
    return instantToZonedLocalDateTime(value, timezone);
  } catch {
    return "";
  }
}

function toInstant(value: string, timezone: string): string | null {
  if (!value) return null;
  try {
    return zonedLocalDateTimeToInstant(value, timezone);
  } catch {
    return null;
  }
}

/** Optional multi-part schedule (rehearsal dinner, ceremony, brunch). Collapsed until the host opens it. */
export function EventSubEventsPanel({ eventId, timezone, canEdit }: { eventId: string; timezone: string; canEdit: boolean }) {
  const [items, setItems] = useState<HostSubEvent[]>([]);
  const [guests, setGuests] = useState<GuestOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [subRes, guestRes] = await Promise.all([
        fetch(`/api/events/${eventId}/sub-events`, { cache: "no-store" }),
        canEdit ? fetch(`/api/events/${eventId}/guests?limit=500`, { cache: "no-store" }) : Promise.resolve(null),
      ]);
      if (subRes.ok) setItems(await subRes.json());
      if (guestRes?.ok) {
        const list = await guestRes.json();
        if (Array.isArray(list)) setGuests(list.map((g: GuestOption) => ({ id: g.id, name: g.name })));
      }
      setError(null);
    } catch {
      setError("The schedule could not be loaded. Try again.");
    } finally {
      setLoaded(true);
    }
  }, [eventId, canEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(item?: HostSubEvent) {
    setError(null);
    if (!item) {
      setDraft(EMPTY);
      setEditingId("new");
      return;
    }
    setDraft({
      title: item.title,
      description: item.description ?? "",
      starts_at: toLocal(item.starts_at, timezone),
      ends_at: toLocal(item.ends_at, timezone),
      location_name: item.location_name ?? "",
      location_address: item.location_address ?? "",
      visibility: item.visibility,
      invited_guest_ids: item.invited_guest_ids,
    });
    setEditingId(item.id);
  }

  async function save() {
    if (!draft.title.trim()) {
      setError("Give this part of the event a name.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      title: draft.title.trim(),
      description: draft.description,
      starts_at: toInstant(draft.starts_at, timezone),
      ends_at: toInstant(draft.ends_at, timezone),
      location_name: draft.location_name,
      location_address: draft.location_address,
      visibility: draft.visibility,
      invited_guest_ids: draft.visibility === "invited_only" ? draft.invited_guest_ids : [],
      ...(editingId === "new" ? { sort_order: items.length } : {}),
    };
    try {
      const res = await fetch(
        editingId === "new" ? `/api/events/${eventId}/sub-events` : `/api/events/${eventId}/sub-events/${editingId}`,
        { method: editingId === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save. Please try again.");
        return;
      }
      setEditingId(null);
      toast("Schedule saved.");
      await load();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: HostSubEvent) {
    if (!(await confirm({ title: `Remove ${item.title}?`, description: "Guests' replies for this part are removed too.", confirmLabel: "Remove" }))) return;
    const res = await fetch(`/api/events/${eventId}/sub-events/${item.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't remove it. Please try again.");
      return;
    }
    toast("Removed.");
    await load();
  }

  const toggleGuest = (id: string) =>
    setDraft((d) => ({
      ...d,
      invited_guest_ids: d.invited_guest_ids.includes(id) ? d.invited_guest_ids.filter((g) => g !== id) : [...d.invited_guest_ids, id],
    }));

  return (
    <details className="rounded-2xl border border-border bg-white">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between px-5 font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
        <span>Schedule (optional)</span>
        {items.length > 0 && <span className="text-sm text-neutral-600">{items.length} part{items.length === 1 ? "" : "s"}</span>}
      </summary>
      <div className="space-y-4 border-t border-border p-5">
        <p className="text-sm text-neutral-600">
          Add parts like a rehearsal dinner or brunch. Guests only see this section once you add something, and parts marked &ldquo;Selected guests&rdquo; are shown only to those guests.
        </p>
        {!loaded && <p className="text-sm text-neutral-600">Loading…</p>}
        {items.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="text-sm text-neutral-600">
                    {[item.starts_at && formatDateTime(item.starts_at, timezone), item.location_name].filter(Boolean).join(" · ") || "No time set"}
                  </p>
                  <p className="text-xs text-neutral-600">
                    {item.attending_headcount} going · {item.maybe_count} maybe · {item.not_attending_count} can&apos;t go
                    {item.visibility === "invited_only" && ` · ${item.invited_guest_ids.length} invited`}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)}>Edit</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void remove(item)}>Remove</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && editingId === null && (
          <Button type="button" variant="outline" onClick={() => startEdit()}>Add a part</Button>
        )}

        {canEdit && editingId !== null && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <Input id="sub-title" label="Name" placeholder="Rehearsal dinner" value={draft.title} maxLength={160}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="sub-start" label={`Starts (${timezone})`} type="datetime-local" value={draft.starts_at}
                onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
              <Input id="sub-end" label="Ends (optional)" type="datetime-local" value={draft.ends_at}
                onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="sub-venue" label="Venue (optional)" value={draft.location_name} maxLength={200}
                onChange={(e) => setDraft({ ...draft, location_name: e.target.value })} />
              <Input id="sub-address" label="Address (optional)" value={draft.location_address} maxLength={500}
                onChange={(e) => setDraft({ ...draft, location_address: e.target.value })} />
            </div>
            <Textarea id="sub-desc" label="Details (optional)" value={draft.description} maxLength={1000}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <Select id="sub-visibility" label="Who can see it" value={draft.visibility}
              options={[{ value: "all", label: "Everyone with the invite" }, { value: "invited_only", label: "Selected guests only" }]}
              onChange={(e) => setDraft({ ...draft, visibility: e.target.value as SubEventVisibility })} />
            {draft.visibility === "invited_only" && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">Guests who see this part</legend>
                {guests.length === 0 ? (
                  <p className="text-sm text-neutral-600">Add guests to your list first. Public-link replies never see selected-guest parts.</p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-3">
                    {guests.map((guest) => (
                      <label key={guest.id} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                        <input type="checkbox" checked={draft.invited_guest_ids.includes(guest.id)} onChange={() => toggleGuest(guest.id)}
                          className="h-4 w-4 rounded border-neutral-300" />
                        {guest.name}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            )}
            <div className="flex gap-2">
              <Button type="button" onClick={() => void save()} loading={busy}>Save</Button>
              <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setError(null); }}>Cancel</Button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-medium text-wax">{error}</p>}
      </div>
    </details>
  );
}

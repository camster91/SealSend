"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckInGuest } from '@/lib/check-in-store';
import { arrivalCounts, sortForDoor } from '@/lib/arrivals';

const REPLY: Record<string, string> = { attending: "Said yes", not_attending: "Said no", maybe: "Said maybe" };

export default function CheckInPage() {
  const eventId = useParams().eventId as string;
  const [guests, setGuests] = useState<CheckInGuest[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const refreshInFlightRef = useRef(false);
  // Kept until the walk-in is saved, so trying again can't add the same person twice.
  const walkInRef = useRef<{ name: string; id: string } | null>(null);
  const load = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/events/${eventId}/check-in`, { cache: "no-store" });
      if (!response.ok) {
        setSyncError(response.status === 404 ? "You do not have check-in access." : "Could not refresh guests.");
        return;
      }
      setGuests(await response.json());
      setLastSyncedAt(new Date().toISOString());
      setSyncError("");
    } catch {
      setSyncError("Could not refresh guests. Check the connection and try again.");
    } finally {
      refreshInFlightRef.current = false;
      setRefreshing(false);
    }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const handleOnline = () => { setOnline(true); void load(); };
    const handleOffline = () => setOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void load();
    };
    setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void load();
    }, 15_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [load]);
  const visible = useMemo(() => sortForDoor(guests).filter((guest) => guest.name.toLowerCase().includes(search.trim().toLowerCase())), [guests, search]);
  async function toggle(guest: CheckInGuest) {
    if (saving) return;
    if (!online) { setError("You are offline. No change was queued or saved; reconnect and try again."); return; }
    setSaving(guest.id);
    try {
      const identity = guest.source === 'public_rsvp' ? { rsvpResponseId: guest.id } : { guestId: guest.id };
      const response = await fetch(`/api/events/${eventId}/check-in`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...identity, checkedIn: !guest.checked_in_at }) });
      if (!response.ok) throw new Error('Check-in failed');
      const updated = await response.json();
      setGuests((current) => current.map((item) => item.id === updated.id && item.source === updated.source ? updated : item));
      setError('');
    } catch { setError('Check-in did not save. Check the connection and try again.'); }
    finally { setSaving(null); }
  }
  async function addWalkIn() {
    const name = search.trim();
    if (saving || !name) return;
    if (!online) { setError("You are offline. No change was queued or saved; reconnect and try again."); return; }
    if (walkInRef.current?.name !== name) walkInRef.current = { name, id: crypto.randomUUID() };
    setSaving("walk-in");
    try {
      const response = await fetch(`/api/events/${eventId}/check-in`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walkInId: walkInRef.current.id, name }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error || "That didn't save. Try again."); return; }
      setGuests((current) => [...current.filter((item) => item.id !== data.id), data]);
      walkInRef.current = null;
      setSearch("");
      setError("");
    } catch { setError("That didn't save. Check the connection and try again."); }
    finally { setSaving(null); }
  }
  async function checkInToken(inviteToken: string) {
    if (!online) { setError("You are offline. Scanned check-ins are not saved until you reconnect."); return; }
    const response = await fetch(`/api/events/${eventId}/check-in`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteToken, checkedIn: true }) });
    if (!response.ok) { setError("That QR code does not identify a guest for this event."); return; }
    const updated = await response.json();
    setGuests((current) => current.map((item) => item.id === updated.id ? updated : item));
    setError(""); stopScanner();
  }
  function stopScanner() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; setScanning(false);
  }
  async function startScanner() {
    const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) { setError("QR scanning is not supported by this browser. Use guest search instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream; setScanning(true);
      const video = videoRef.current;
      if (!video) { stopScanner(); return; }
      video.srcObject = stream; await video.play();
      const detector = new Detector({ formats: ["qr_code"] });
      while (streamRef.current === stream) {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) {
          try { const token = new URL(codes[0].rawValue).searchParams.get("t"); if (token) { await checkInToken(token); stopScanner(); return; } } catch { /* Ignore non-URL QR codes. */ }
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } catch { setError("Camera access was unavailable. Use guest search instead."); stopScanner(); }
  }
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  const counts = arrivalCounts(guests);
  const lastConfirmedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Not yet confirmed";
  return <div className="mx-auto max-w-xl py-4 print:max-w-none">
    <Link href={`/events/${eventId}`} className="text-sm font-medium text-brand-700 print:hidden">← Event overview</Link>
    <div className="mt-4 flex items-end justify-between gap-3 print:hidden">
      <div>
        <h1 className="text-2xl font-bold">Guest check-in</h1>
        <p className="text-base text-ink"><strong>{counts.here}</strong> here · <strong>{counts.toCome}</strong> still to come</p>
      </div>
      <button onClick={() => scanning ? stopScanner() : void startScanner()} className="min-h-11 rounded-xl border border-input bg-white px-4 text-sm font-semibold">{scanning ? "Stop camera" : "Scan QR"}</button>
    </div>
    <video hidden={!scanning} ref={videoRef} muted playsInline aria-label="QR code camera preview" className="mt-3 aspect-video w-full rounded-xl bg-black object-cover print:hidden" />
    {/* Search and problems stay in view, so a failed tap far down the list is never missed. */}
    <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-cotton px-1 py-3 print:hidden">
      <input aria-label="Search guests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guests" className="h-12 w-full rounded-xl border border-input bg-white px-4 text-base" />
      {!online && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Offline. Nothing saves until you reconnect. Print the loaded list under More for manual check-in, then reconcile after reconnecting.</p>}
      {syncError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{syncError}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
    {lastSyncedAt && !visible.length && !search.trim() && <p role="status" className="rounded-xl border border-border bg-white p-4 text-sm text-gray-700 print:hidden">No guests or public RSVP respondents yet.</p>}
    {lastSyncedAt && !visible.length && search.trim() && <p role="status" className="text-sm text-gray-700 print:hidden">No guests match your search. Try another name or clear the search.</p>}
    <ul className="mt-2 space-y-2 print:hidden">{visible.map((guest) => <li key={`${guest.source}-${guest.id}`}>
      {guest.checked_in_at
        ? <div className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-green-300 bg-green-50 p-4"><GuestLabel guest={guest} /><span className="flex shrink-0 items-center gap-2"><span className="text-sm font-semibold text-green-800">Checked in</span><button type="button" disabled={Boolean(saving)} aria-busy={saving === guest.id} onClick={() => void toggle(guest)} aria-label={`Undo check-in for ${guest.name}`} className="min-h-11 rounded-lg border border-input bg-white px-3 text-sm font-medium text-ink disabled:opacity-60">Undo</button></span></div>
        : <button type="button" disabled={Boolean(saving)} aria-busy={saving === guest.id} onClick={() => void toggle(guest)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-input bg-white p-4 text-left disabled:opacity-60"><GuestLabel guest={guest} /><span className="shrink-0 rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white">{saving === guest.id ? 'Saving…' : 'Check in'}</span></button>}
    </li>)}</ul>
    {lastSyncedAt && search.trim() && !visible.some((guest) => guest.name.trim().toLowerCase() === search.trim().toLowerCase()) && <button type="button" disabled={Boolean(saving)} aria-busy={saving === "walk-in"} onClick={() => void addWalkIn()} className="mt-3 min-h-12 w-full break-words rounded-xl border border-input bg-white px-4 text-sm font-semibold text-ink disabled:opacity-60 print:hidden">Add {search.trim()} and check in</button>}
    <details className="mt-6 rounded-xl border border-border bg-white print:hidden">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-ink">More</summary>
      <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
        <button type="button" onClick={() => void load()} disabled={!online || refreshing} aria-busy={refreshing} className="min-h-11 rounded-xl border border-input bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{refreshing ? "Refreshing…" : "Refresh guest list"}</button>
        <button type="button" onClick={() => window.print()} disabled={guests.length === 0} className="min-h-11 rounded-xl border border-input bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">Print loaded guest list</button>
        <p className="w-full text-sm text-neutral-700">Last confirmed: {lastSyncedAt ? <time dateTime={lastSyncedAt}>{lastConfirmedLabel}</time> : lastConfirmedLabel}</p>
      </div>
    </details>
    <section className="hidden print:block">
      <h1 className="text-2xl font-bold">Guest check-in list</h1>
      <p className="mt-1 text-sm">Loaded guests: {guests.length} · Last confirmed: {lastConfirmedLabel}</p>
      <table className="hidden print:table mt-6 w-full border-collapse text-left text-sm">
        <thead><tr><th className="border-b-2 border-black py-2 pr-4">Guest</th><th className="border-b-2 border-black py-2 pr-4">RSVP</th><th className="border-b-2 border-black py-2">Check-in</th></tr></thead>
        <tbody>{guests.map((guest) => <tr key={guest.id}><td className="border-b border-gray-400 py-3 pr-4">{guest.name}</td><td className="border-b border-gray-400 py-3 pr-4">{guest.rsvp_status}</td><td className="border-b border-gray-400 py-3">{guest.checked_in_at ? "Checked in" : "□"}</td></tr>)}</tbody>
      </table>
    </section>
  </div>;
}

function GuestLabel({ guest }: { guest: CheckInGuest }) {
  const details = [REPLY[guest.rsvp_status], guest.headcount > 1 ? `${guest.headcount} people` : ""].filter(Boolean).join(" · ");
  return <span className="min-w-0"><span className="block break-words font-semibold text-ink">{guest.name}</span>{details && <span className="text-sm text-gray-700">{details}</span>}</span>;
}

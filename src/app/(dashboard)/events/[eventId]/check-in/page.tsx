"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckInGuest } from '@/lib/check-in-store';

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
  const visible = useMemo(() => guests.filter((guest) => guest.name.toLowerCase().includes(search.toLowerCase())), [guests, search]);
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
  const checked = guests.filter((guest) => guest.checked_in_at).length;
  const lastConfirmedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Not yet confirmed";
  return <div className="mx-auto max-w-xl py-4 print:max-w-none">
    <Link href={`/events/${eventId}`} className="text-sm font-medium text-brand-700 print:hidden">← Event overview</Link>
    <div className="mt-4 flex items-end justify-between gap-3 print:hidden"><div><h1 className="text-2xl font-bold">Guest check-in</h1><p className="text-sm text-gray-500">{checked} of {guests.length} entries checked in</p></div><button onClick={() => scanning ? stopScanner() : void startScanner()} className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold">{scanning ? "Stop camera" : "Scan QR"}</button></div>
    <p className="mt-2 text-sm text-gray-600 print:hidden">Includes invited guests and public replies. A group reply is checked in together.</p>
    <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
      <p role="status" className={`min-h-11 flex-1 rounded-lg p-3 text-sm ${online ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>{online ? "Online — each check-in is confirmed by the server before the screen updates." : "Offline — server updates are paused. Print the loaded list for manual check-in, then reconcile after reconnecting."}</p>
      <button type="button" onClick={() => void load()} disabled={!online || refreshing} aria-busy={refreshing} className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{refreshing ? "Refreshing…" : "Refresh guest list"}</button>
      <button type="button" onClick={() => window.print()} disabled={guests.length === 0} className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">Print loaded guest list</button>
    </div>
    <p className="mt-2 text-xs text-gray-500 print:hidden">Last confirmed: {lastSyncedAt ? <time dateTime={lastSyncedAt}>{lastConfirmedLabel}</time> : lastConfirmedLabel}</p>
    <video hidden={!scanning} ref={videoRef} muted playsInline aria-label="QR code camera preview" className="mt-3 aspect-video w-full rounded-xl bg-black object-cover print:hidden" />
    <input aria-label="Search guests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guests" className="mt-5 h-12 w-full rounded-xl border border-gray-300 px-4 text-base print:hidden" />
    {syncError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{syncError}</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</p>}
    {lastSyncedAt && !visible.length && <p role="status" className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 print:hidden">{search.trim() ? 'No guests match your search. Try another name or clear the search.' : 'No guests or public RSVP respondents yet.'}</p>}
    <div className="mt-4 space-y-3 print:hidden">{visible.map((guest) => <button key={`${guest.source}-${guest.id}`} disabled={Boolean(saving)} aria-busy={saving === guest.id} onClick={() => void toggle(guest)} className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border p-4 text-left disabled:opacity-60 ${guest.checked_in_at ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}><span><span className="block break-words font-semibold">{guest.name}</span><span className="text-xs text-gray-600">RSVP: {guest.rsvp_status}{guest.source === 'public_rsvp' ? ` · Public reply · ${guest.headcount} ${guest.headcount === 1 ? 'guest' : 'guests'}` : ''}</span></span><span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${guest.checked_in_at ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}>{saving === guest.id ? 'Saving…' : guest.checked_in_at ? "Checked in" : "Check in"}</span></button>)}</div>
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

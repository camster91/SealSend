"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CheckInGuest = { id: string; name: string; rsvp_status: string; checked_in_at: string | null };

export default function CheckInPage() {
  const eventId = useParams().eventId as string;
  const [guests, setGuests] = useState<CheckInGuest[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
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
    if (!online) { setError("You are offline. No change was queued or saved; reconnect and try again."); return; }
    const response = await fetch(`/api/events/${eventId}/check-in`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestId: guest.id, checkedIn: !guest.checked_in_at }) });
    if (!response.ok) { setError("Check-in did not save. Try again."); return; }
    const updated = await response.json();
    setGuests((current) => current.map((item) => item.id === updated.id ? updated : item));
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
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const video = videoRef.current;
      if (!video) { stopScanner(); return; }
      video.srcObject = stream; await video.play();
      const detector = new Detector({ formats: ["qr_code"] });
      while (streamRef.current === stream) {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) {
          try { const token = new URL(codes[0].rawValue).searchParams.get("t"); if (token) { await checkInToken(token); return; } } catch { /* Ignore non-URL QR codes. */ }
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } catch { setError("Camera access was unavailable. Use guest search instead."); stopScanner(); }
  }
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  const checked = guests.filter((guest) => guest.checked_in_at).length;
  return <div className="mx-auto max-w-xl py-4">
    <Link href={`/events/${eventId}`} className="text-sm font-medium text-brand-700">← Event overview</Link>
    <div className="mt-4 flex items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Guest check-in</h1><p className="text-sm text-gray-500">{checked} of {guests.length} checked in</p></div><button onClick={() => scanning ? stopScanner() : void startScanner()} className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold">{scanning ? "Stop camera" : "Scan QR"}</button></div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <p role="status" className={`min-h-11 flex-1 rounded-lg p-3 text-sm ${online ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>{online ? "Online — each check-in is confirmed by the server before the screen updates." : "Offline — check-in is paused and no changes will be queued."}</p>
      <button type="button" onClick={() => void load()} disabled={!online || refreshing} aria-busy={refreshing} className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{refreshing ? "Refreshing…" : "Refresh guest list"}</button>
    </div>
    {scanning && <video ref={videoRef} muted playsInline aria-label="QR code camera preview" className="mt-3 aspect-video w-full rounded-xl bg-black object-cover" />}
    <input aria-label="Search guests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guests" className="mt-5 h-12 w-full rounded-xl border border-gray-300 px-4 text-base" />
    {syncError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{syncError}</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-4 space-y-3">{visible.map((guest) => <button key={guest.id} onClick={() => void toggle(guest)} className={`flex min-h-16 w-full items-center justify-between rounded-xl border p-4 text-left ${guest.checked_in_at ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}><span><span className="block font-semibold">{guest.name}</span><span className="text-xs text-gray-500">RSVP: {guest.rsvp_status}</span></span><span className={`rounded-full px-3 py-1 text-sm font-semibold ${guest.checked_in_at ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}>{guest.checked_in_at ? "Checked in" : "Check in"}</span></button>)}</div>
  </div>;
}

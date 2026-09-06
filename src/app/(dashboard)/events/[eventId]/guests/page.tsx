"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { GuestTable } from "@/components/guests/GuestTable";
import { AddGuestModal } from "@/components/guests/AddGuestModal";
import { ImportCSVModal } from "@/components/guests/ImportCSVModal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { useToast } from "@/components/ui/Toast";
import { UserPlus, ArrowLeft, Mail, Upload, Bell, Download, Users } from "lucide-react";
import Link from "next/link";
import type { Guest } from "@/types/database";

type PendingAction = "invites" | "reminders" | null;

export default function GuestsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; message: string } | null>(
    null
  );

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/guests?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setGuests(Array.isArray(data) ? data : []);
      } else {
        setLoadError("Could not load guests. Please refresh.");
      }
    } catch {
      setLoadError("Network error while loading guests.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  function handleEdit(guest: Guest) {
    setEditingGuest(guest);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setEditingGuest(null);
  }

  const pendingCount = guests.filter(
    (g) =>
      (g.email || g.phone) &&
      (g.invite_status === "not_sent" || g.invite_status === "failed")
  ).length;

  const reminderCount = guests.filter(
    (g) => (g.email || g.phone) && g.invite_status === "sent" && !g.reminder_sent_at
  ).length;

  async function runSend(kind: "invites" | "reminders") {
    setSending(true);
    setPendingAction(null);
    setNotice(null);
    try {
      const endpoint =
        kind === "invites"
          ? `/api/events/${eventId}/send-invites`
          : `/api/events/${eventId}/send-reminders`;
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error || `Failed to send ${kind}.`;
        setNotice({ tone: "error", message: msg });
        toastRef.current.error(msg);
        return;
      }

      const parts: string[] = [];
      if (data.sent > 0) parts.push(`${data.sent} email${data.sent !== 1 ? "s" : ""} sent`);
      if (data.failed > 0) parts.push(`${data.failed} email failed`);
      if (data.sms_sent > 0) parts.push(`${data.sms_sent} SMS sent`);
      if (data.sms_failed > 0) parts.push(`${data.sms_failed} SMS failed`);
      const message = parts.join(", ") || `No ${kind} to send.`;
      const tone = data.failed || data.sms_failed ? "error" : "success";
      setNotice({ tone, message });
      if (tone === "success") toastRef.current.success(message);
      else toastRef.current.info(message);
      fetchGuests();
    } catch {
      const msg = `Failed to send ${kind}. Check your connection.`;
      setNotice({ tone: "error", message: msg });
      toastRef.current.error(msg);
    } finally {
      setSending(false);
    }
  }

  function requestInvites() {
    if (pendingCount === 0) {
      toastRef.current.info("No guests with unsent invitations.");
      return;
    }
    setPendingAction("invites");
  }

  function requestReminders() {
    if (reminderCount === 0) {
      toastRef.current.info("No guests eligible for reminders.");
      return;
    }
    setPendingAction("reminders");
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/events/${eventId}`}
          className="mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to event
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Guest List</h1>
            <p className="text-sm text-muted-foreground">
              {guests.length} guest{guests.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reminderCount > 0 && (
              <Button
                variant="outline"
                onClick={requestReminders}
                loading={sending && pendingAction === null}
                disabled={sending}
              >
                <Bell className="mr-2 h-4 w-4" />
                Send Reminders
              </Button>
            )}
            {pendingCount > 0 && (
              <Button variant="outline" onClick={requestInvites} disabled={sending}>
                <Mail className="mr-2 h-4 w-4" />
                Send Invites
              </Button>
            )}
            <Button variant="outline" onClick={() => setCsvModalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <a
              href={`/api/events/${eventId}/guests?format=check-in-csv`}
              download
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Download className="mr-2 h-4 w-4" />
              Download check-in fallback
            </a>
            <Button onClick={() => setModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Guest
            </Button>
          </div>
        </div>
      </div>

      {loadError && (
        <InlineBanner
          variant="error"
          title="Something went wrong"
          onDismiss={() => setLoadError(null)}
          className="mb-4"
        >
          {loadError}
        </InlineBanner>
      )}

      {notice && (
        <InlineBanner
          variant={notice.tone === "error" ? "error" : "success"}
          onDismiss={() => setNotice(null)}
          className="mb-4"
        >
          {notice.message}
        </InlineBanner>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : guests.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No guests yet"
          description="Add guests one by one or import a CSV to start sending invitations."
          actionLabel="Add Guest"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <GuestTable
          guests={guests}
          eventId={eventId}
          onEdit={handleEdit}
          onRefresh={fetchGuests}
          onRemoved={(id) => setGuests((prev) => prev.filter((g) => g.id !== id))}
        />
      )}

      <AddGuestModal
        open={modalOpen}
        onClose={handleClose}
        eventId={eventId}
        guest={editingGuest}
        onSuccess={fetchGuests}
      />

      <ImportCSVModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        eventId={eventId}
        onSuccess={fetchGuests}
      />

      <ConfirmDialog
        open={pendingAction === "invites"}
        title="Send invitations?"
        description={`Send invitations to ${pendingCount} guest${pendingCount !== 1 ? "s" : ""} now?`}
        confirmLabel="Send invites"
        variant="default"
        loading={sending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => runSend("invites")}
      />

      <ConfirmDialog
        open={pendingAction === "reminders"}
        title="Send reminders?"
        description={`Send reminders to ${reminderCount} guest${reminderCount !== 1 ? "s" : ""} who haven’t responded yet.`}
        confirmLabel="Send reminders"
        variant="default"
        loading={sending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => runSend("reminders")}
      />
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { GuestTable } from "@/components/guests/GuestTable";
import { AddGuestModal } from "@/components/guests/AddGuestModal";
import { ImportCSVModal } from "@/components/guests/ImportCSVModal";
import { Button } from "@/components/ui/Button";
import { UserPlus, ArrowLeft, Mail, Loader2, Upload, Bell } from "lucide-react";
import Link from "next/link";
import type { Guest } from "@/types/database";

export default function GuestsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/guests?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setGuests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load guests:", err);
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

  async function handleSendInvites() {
    setNotice(null);
    const pendingCount = guests.filter(
      (g) => (g.email || g.phone) && (g.invite_status === "not_sent" || g.invite_status === "failed")
    ).length;

    if (pendingCount === 0) {
      setNotice({ tone: "error", message: "No guests with unsent invitations." });
      return;
    }

    if (!confirm(`Send invitations to ${pendingCount} guest${pendingCount !== 1 ? "s" : ""}?`)) {
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/send-invites`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice({ tone: "error", message: data.error || "Failed to send invitations." });
      } else {
        const parts: string[] = [];
        if (data.sent > 0) parts.push(`${data.sent} email${data.sent !== 1 ? "s" : ""} sent`);
        if (data.failed > 0) parts.push(`${data.failed} email${data.failed !== 1 ? "s" : ""} failed`);
        if (data.sms_sent > 0) parts.push(`${data.sms_sent} SMS sent`);
        if (data.sms_failed > 0) parts.push(`${data.sms_failed} SMS failed`);
        setNotice({ tone: data.failed || data.sms_failed ? "error" : "success", message: parts.join(", ") || "No invitations to send." });
        fetchGuests();
      }
    } catch {
      setNotice({ tone: "error", message: "Failed to send invitations." });
    } finally {
      setSending(false);
    }
  }

  async function handleSendReminders() {
    setNotice(null);
    const reminderCount = guests.filter(
      (g) => (g.email || g.phone) && g.invite_status === "sent" && !g.reminder_sent_at
    ).length;

    if (reminderCount === 0) {
      setNotice({ tone: "error", message: "No guests eligible for reminders." });
      return;
    }

    if (!confirm(`Send reminders to ${reminderCount} guest${reminderCount !== 1 ? "s" : ""}?`)) {
      return;
    }

    setSendingReminders(true);
    try {
      const res = await fetch(`/api/events/${eventId}/send-reminders`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice({ tone: "error", message: data.error || "Failed to send reminders." });
      } else {
        const parts: string[] = [];
        if (data.sent > 0) parts.push(`${data.sent} email${data.sent !== 1 ? "s" : ""} sent`);
        if (data.failed > 0) parts.push(`${data.failed} email${data.failed !== 1 ? "s" : ""} failed`);
        if (data.sms_sent > 0) parts.push(`${data.sms_sent} SMS sent`);
        if (data.sms_failed > 0) parts.push(`${data.sms_failed} SMS failed`);
        setNotice({ tone: data.failed || data.sms_failed ? "error" : "success", message: parts.join(", ") || "No reminders to send." });
        fetchGuests();
      }
    } catch {
      setNotice({ tone: "error", message: "Failed to send reminders." });
    } finally {
      setSendingReminders(false);
    }
  }

  const hasUnsent = guests.some(
    (g) => (g.email || g.phone) && (g.invite_status === "not_sent" || g.invite_status === "failed")
  );

  const hasRemindable = guests.some(
    (g) => (g.email || g.phone) && g.invite_status === "sent" && !g.reminder_sent_at
  );

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/events/${eventId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to event
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Guest List</h1>
            <p className="text-sm text-muted-foreground">
              {guests.length} guest{guests.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasRemindable && (
              <Button variant="outline" onClick={handleSendReminders} disabled={sendingReminders}>
                {sendingReminders ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                Send Reminders
              </Button>
            )}
            {hasUnsent && (
              <Button variant="outline" onClick={handleSendInvites} disabled={sending}>
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send Invites
              </Button>
            )}
            <Button variant="outline" onClick={() => setCsvModalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={() => setModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Guest
            </Button>
          </div>
        </div>
      </div>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-5 rounded-xl border p-4 text-sm ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
        >
          {notice.message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <GuestTable
          guests={guests}
          eventId={eventId}
          onEdit={handleEdit}
          onRefresh={fetchGuests}
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
    </div>
  );
}

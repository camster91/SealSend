"use client";

import { useState, useMemo } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { useToast } from "@/components/ui/Toast";
import { Trash2, Edit2 } from "lucide-react";
import type { Guest, InviteStatus } from "@/types/database";

const inviteBadge: Record<
  InviteStatus,
  { label: string; variant: "secondary" | "success" | "destructive" }
> = {
  not_sent: { label: "Not Sent", variant: "secondary" },
  sent: { label: "Sent", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

interface GuestTableProps {
  guests: Guest[];
  eventId: string;
  onEdit: (guest: Guest) => void;
  onRefresh: () => void;
  onRemoved?: (guestId: string) => void;
}

export function GuestTable({
  guests,
  eventId,
  onEdit,
  onRefresh,
  onRemoved,
}: GuestTableProps) {
  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Guest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const guest = pendingDelete;
    setBusy(true);
    setDeletingId(guest.id);
    setError(null);
    setPendingDelete(null);
    onRemoved?.(guest.id);
    try {
      const res = await fetch(`/api/events/${eventId}/guests/${guest.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Failed to remove guest. Please try again.");
        toast.error("Failed to remove guest. Please try again.");
        onRefresh();
        return;
      }
      toast.success(`${guest.name} removed`);
    } catch {
      setError("Network error. Check your connection and try again.");
      toast.error("Network error. Check your connection and try again.");
      onRefresh();
    } finally {
      setBusy(false);
      setDeletingId(null);
    }
  }

  const columns: Column<Guest & Record<string, unknown>>[] = useMemo(
    () => [
      { key: "name", header: "Name", sortable: true },
      {
        key: "email",
        header: "Email",
        sortable: true,
        render: (item) => (
          <span className="text-muted-foreground">{item.email || "\u2014"}</span>
        ),
      },
      {
        key: "phone",
        header: "Phone",
        render: (item) => (
          <span className="text-muted-foreground">{item.phone || "\u2014"}</span>
        ),
      },
      {
        key: "invite_status",
        header: "Invite",
        render: (item) => {
          const guest = item as Guest;
          if (!guest.email && !guest.phone) {
            return <span className="text-muted-foreground">\u2014</span>;
          }
          const badge = inviteBadge[guest.invite_status] || inviteBadge.not_sent;
          return <Badge variant={badge.variant}>{badge.label}</Badge>;
        },
      },
      {
        key: "actions",
        header: "",
        className: "w-28",
        render: (item) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item as Guest);
              }}
              aria-label={`Edit ${item.name}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Edit2 className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(item as Guest);
              }}
              disabled={deletingId === item.id}
              aria-label={`Delete ${item.name}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-error-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500"
            >
              <Trash2 className="h-4 w-4 text-error-500" />
            </button>
          </div>
        ),
      },
    ],
    [deletingId, onEdit]
  );

  return (
    <div className="space-y-2">
      {error && (
        <InlineBanner variant="error" onDismiss={() => setError(null)}>
          {error}
        </InlineBanner>
      )}
      <DataTable
        columns={columns}
        data={guests as (Guest & Record<string, unknown>)[]}
        keyExtractor={(item) => item.id}
        emptyMessage="No guests added yet"
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove guest?"
        description={
          pendingDelete
            ? `Remove ${pendingDelete.name} from this event? This cannot be undone.`
            : ""
        }
        confirmLabel="Remove"
        loading={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

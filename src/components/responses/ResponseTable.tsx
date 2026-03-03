"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Trash2, ChevronDown, ChevronRight, Mail, UserPlus } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { RSVPResponseWithPlusOnes, PlusOne } from "@/types/database";
import { cn } from "@/lib/utils";

interface ResponseTableProps {
  responses: RSVPResponseWithPlusOnes[];
  eventId: string;
  onRefresh: () => void;
  filter?: string;
}

const statusVariant: Record<string, "success" | "destructive" | "default" | "secondary"> = {
  attending: "success",
  not_attending: "destructive",
  maybe: "default",
  pending: "secondary",
};

const statusLabel: Record<string, string> = {
  attending: "Attending",
  not_attending: "Not Attending",
  maybe: "Maybe",
  pending: "Pending",
};

const inviteStatusBadge: Record<string, { label: string; className: string }> = {
  not_sent: { label: "Not Sent", className: "bg-neutral-100 text-neutral-600" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

export function ResponseTable({ responses, eventId, onRefresh, filter }: ResponseTableProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filtered = filter && filter !== "all"
    ? responses.filter((r) => r.status === filter)
    : responses;

  async function handleDelete(responseId: string) {
    if (!confirm("Delete this response?")) return;
    setDeleting(responseId);
    try {
      await fetch(`/api/events/${eventId}/responses/${responseId}`, {
        method: "DELETE",
      });
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  function toggleExpand(responseId: string) {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(responseId)) {
        newSet.delete(responseId);
      } else {
        newSet.add(responseId);
      }
      return newSet;
    });
  }

  const columns: Column<RSVPResponseWithPlusOnes & Record<string, unknown>>[] = [
    {
      key: "expand",
      header: "",
      className: "w-8",
      render: (item) => {
        const response = item as RSVPResponseWithPlusOnes;
        const hasPlusOnes = (response.plus_ones?.length || 0) > 0;
        if (!hasPlusOnes) return null;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(response.id);
            }}
            className="p-1 hover:bg-neutral-100 rounded"
          >
            {expandedRows.has(response.id) ? (
              <ChevronDown className="h-4 w-4 text-neutral-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-neutral-500" />
            )}
          </button>
        );
      },
    },
    { key: "respondent_name", header: "Name", sortable: true },
    {
      key: "respondent_email",
      header: "Email",
      render: (item) => (
        <span className="text-muted-foreground">
          {(item as RSVPResponseWithPlusOnes).respondent_email || "\u2014"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (item) => {
        const r = item as RSVPResponseWithPlusOnes;
        return (
          <Badge variant={statusVariant[r.status] || "secondary"}>
            {statusLabel[r.status] || r.status}
          </Badge>
        );
      },
    },
    {
      key: "headcount",
      header: "Guests",
      sortable: true,
      render: (item) => {
        const r = item as RSVPResponseWithPlusOnes;
        const plusOnesCount = r.plus_ones?.length || 0;
        return (
          <div className="flex items-center gap-1">
            <span>{r.headcount}</span>
            {plusOnesCount > 0 && (
              <span className="text-xs text-neutral-500">
                ({plusOnesCount} named)
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "submitted_at",
      header: "Submitted",
      sortable: true,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime((item as RSVPResponseWithPlusOnes).submitted_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(item.id as string);
          }}
          disabled={deleting === item.id}
          className="rounded-lg p-1.5 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 text-accent-red" />
        </button>
      ),
    },
  ];

  // Custom row renderer to show expanded plus_ones
  function renderExpandedRow(response: RSVPResponseWithPlusOnes) {
    if (!expandedRows.has(response.id)) return null;
    
    const plusOnes = response.plus_ones || [];
    if (plusOnes.length === 0) return null;

    return (
      <tr className="bg-neutral-50">
        <td colSpan={columns.length} className="px-4 py-3">
          <div className="pl-8 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-600 mb-2">
              <UserPlus className="h-4 w-4" />
              Plus Ones ({plusOnes.length})
            </div>
            <div className="space-y-2">
              {plusOnes.map((plusOne: PlusOne, index: number) => (
                <div
                  key={plusOne.id}
                  className="flex items-center justify-between bg-white rounded-lg border border-neutral-200 px-4 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-400 text-xs w-6">{index + 1}.</span>
                    <span className="font-medium">{plusOne.name}</span>
                    {plusOne.email && (
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {plusOne.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[plusOne.status] || "secondary"} className="text-xs">
                      {statusLabel[plusOne.status] || plusOne.status}
                    </Badge>
                    {plusOne.email && (
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          inviteStatusBadge[plusOne.invite_status]?.className || inviteStatusBadge.not_sent.className
                        )}
                      >
                        {inviteStatusBadge[plusOne.invite_status]?.label || "Not Sent"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-2">
      <DataTable
        columns={columns}
        data={filtered as (RSVPResponseWithPlusOnes & Record<string, unknown>)[]}
        keyExtractor={(item) => item.id as string}
        emptyMessage="No responses yet"
        renderExpandedRow={(item) => renderExpandedRow(item as RSVPResponseWithPlusOnes)}
      />
    </div>
  );
}

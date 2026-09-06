"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ResponseStats } from "@/components/responses/ResponseStats";
import { ResponseTable } from "@/components/responses/ResponseTable";
import { ExportCSVButton } from "@/components/responses/ExportCSVButton";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ArrowLeft, Inbox } from "lucide-react";
import Link from "next/link";
import type { RSVPResponseWithPlusOnes } from "@/types/database";
import { RsvpIntelligence } from "@/components/responses/RsvpIntelligence";

export default function ResponsesPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [responses, setResponses] = useState<RSVPResponseWithPlusOnes[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/responses?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setResponses(Array.isArray(data) ? data : []);
      } else {
        setLoadError("Could not load responses.");
      }
    } catch {
      setLoadError("Network error while loading responses.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const filters = [
    { id: "all", label: "All" },
    { id: "attending", label: "Attending" },
    { id: "not_attending", label: "Not Attending" },
    { id: "maybe", label: "Maybe" },
  ];

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">RSVP Responses</h1>
            <p className="text-sm text-muted-foreground">
              {responses.length} response{responses.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ExportCSVButton eventId={eventId} />
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

      {loading ? (
        <div className="space-y-4">
          <TableSkeleton rows={3} />
          <TableSkeleton rows={5} />
        </div>
      ) : (
        <>
          <RsvpIntelligence eventId={eventId} />
          <div className="mb-6">
            <ResponseStats responses={responses} />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map((f) => (
              <Button
                key={f.id}
                variant={filter === f.id ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {responses.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No responses yet"
              description="Once guests RSVP, their answers will show up here with plus-ones and custom fields."
            />
          ) : (
            <ResponseTable
              responses={responses}
              eventId={eventId}
              onRefresh={fetchResponses}
              onRemoved={(id) => setResponses((prev) => prev.filter((r) => r.id !== id))}
              filter={filter}
            />
          )}
        </>
      )}
    </div>
  );
}

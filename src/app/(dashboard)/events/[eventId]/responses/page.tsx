"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ResponseStats } from "@/components/responses/ResponseStats";
import { ResponseTable } from "@/components/responses/ResponseTable";
import { ExportCSVButton } from "@/components/responses/ExportCSVButton";
import { Button } from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { RSVPResponseWithPlusOnes } from "@/types/database";
import { RsvpIntelligence } from "@/components/responses/RsvpIntelligence";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function ResponsesPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [responses, setResponses] = useState<RSVPResponseWithPlusOnes[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState('');

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/responses?limit=500`);
      if (!res.ok) throw new Error('Response load failed');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid response list');
      setResponses(data);
      setError('');
    } catch {
      setError('Responses could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

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
            <h1 className="text-2xl font-bold">RSVP Responses</h1>
            <p className="text-sm text-muted-foreground">
              {responses.length} response{responses.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ExportCSVButton eventId={eventId} />
        </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-900"><p>{error}</p><button type="button" onClick={() => void fetchResponses()} className="mt-2 min-h-11 font-semibold underline">Retry loading responses</button></div>}
      {loading ? (
        <TableSkeleton label="Loading responses" columns={4} />
      ) : (
        <>
          <RsvpIntelligence eventId={eventId} />
          <div className="mb-6">
            <ResponseStats responses={responses} />
          </div>

          <div className="mb-4 flex gap-2">
            {["all", "attending", "not_attending", "maybe"].map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === "all"
                  ? "All"
                  : f === "attending"
                    ? "Attending"
                    : f === "not_attending"
                      ? "Not Attending"
                      : "Maybe"}
              </Button>
            ))}
          </div>

          <ResponseTable
            responses={responses}
            eventId={eventId}
            onRefresh={fetchResponses}
            filter={filter}
          />
        </>
      )}
    </div>
  );
}

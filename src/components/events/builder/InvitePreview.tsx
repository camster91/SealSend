"use client";

import { useEffect, useMemo, useState } from "react";
import { EventDetails } from "@/components/public-event/EventDetails";
import { EventHero } from "@/components/public-event/EventHero";
import { builderDataToPreviewEvent } from "@/lib/event-builder/mapping";
import type { BuilderData } from "@/lib/event-builder/schema";

/** The invite as guests will see it, redrawn on every change. */
export function InvitePreview({ data }: { data: BuilderData }) {
  const event = useMemo(() => builderDataToPreviewEvent(data), [data]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // The live preview uses browser date formatting. Its first render must match
  // server HTML even when the browser and Node ship different ICU data.
  if (!mounted) return <div aria-label="Loading invite preview" className="min-h-64 rounded-xl border border-border bg-white" />;
  return (
    // Display only: inert keeps its links and buttons out of the tab order.
    <div inert className="overflow-hidden rounded-xl border border-border bg-white">
      <EventHero event={event} />
      <div className="p-5">
        <EventDetails event={event} />
      </div>
    </div>
  );
}

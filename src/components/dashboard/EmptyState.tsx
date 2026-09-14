import { CalendarPlus } from "lucide-react";
import { EmptyState as UiEmptyState } from "@/components/ui/EmptyState";

/** Dashboard home empty state — thin wrapper around shared UI EmptyState. */
export function EmptyState() {
  return (
    <UiEmptyState
      icon={CalendarPlus}
      title="No events yet"
      description="Create your first event to get started with invitations, RSVPs, and guest workflows."
      actionLabel="Create Event"
      actionHref="/events/new"
    />
  );
}

import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { enqueueWebhookEvent } from "@/lib/webhooks";

/**
 * Shared post-publish side effects so publishing via POST /publish,
 * PATCH /events/[eventId], or POST /events never drifts.
 */
export async function afterEventPublished(input: {
  eventId: string;
  userId: string;
  source: "dashboard" | "patch" | "create";
}): Promise<void> {
  await enqueueWebhookEvent(input.eventId, "event.published", {});
  await recordActivationEventSafely({
    name: "event_published",
    userId: input.userId,
    eventId: input.eventId,
    metadata: { source: input.source },
  });
}

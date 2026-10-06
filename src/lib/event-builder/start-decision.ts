export type OpenEvent = { id: string; status: "draft" | "published"; title: string };

export type StartDecision =
  | { kind: "fresh" }
  | { kind: "continue-draft"; eventId: string; title: string }
  | { kind: "at-limit"; eventId: string; title: string };

/**
 * Decides what the start screen shows. `canCreate` is
 * canCreateEvent(accountPlan, openEvents.length), the rule POST /api/events enforces.
 */
export function decideStart(openEvents: OpenEvent[], canCreate: boolean): StartDecision {
  if (canCreate || openEvents.length === 0) return { kind: "fresh" };
  const draft = openEvents.find((e) => e.status === "draft");
  if (draft) return { kind: "continue-draft", eventId: draft.id, title: draft.title };
  const first = openEvents[0];
  return { kind: "at-limit", eventId: first.id, title: first.title };
}

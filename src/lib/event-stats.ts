/**
 * Single source of truth for event attendance, walk-in, and waiting counts.
 * Every screen, capacity check, summary API, and client report imports from here
 * so totals never drift across surfaces.
 */

/** Door walk-ins: guests marked attending with no linked rsvp_responses row. */
export function walkInCountSql(eventIdExpr: string): string {
  return `(SELECT COUNT(*) FROM guests g
    WHERE g.event_id = ${eventIdExpr}
      AND g.rsvp_status = 'attending'
      AND NOT EXISTS (SELECT 1 FROM rsvp_responses r WHERE r.event_id = ${eventIdExpr} AND r.guest_id = g.id))`;
}

/** Invited primary guests who have neither replied nor been checked in as walk-ins. */
export function awaitingReplyCountSql(eventIdExpr: string): string {
  return `(SELECT COUNT(*) FROM guests g
    WHERE g.event_id = ${eventIdExpr}
      AND g.parent_guest_id IS NULL
      AND COALESCE(g.rsvp_status, 'pending') = 'pending'
      AND NOT EXISTS (SELECT 1 FROM rsvp_responses r WHERE r.event_id = ${eventIdExpr} AND r.guest_id = g.id))`;
}

/** Total people attending (attending RSVP headcount + door walk-ins), optionally excluding one response id. */
export function attendingPeopleSql(eventIdExpr: string, excludeResponseIdExpr?: string): string {
  const excludeClause = excludeResponseIdExpr
    ? ` AND (${excludeResponseIdExpr} IS NULL OR r.id <> ${excludeResponseIdExpr})`
    : "";
  return `(COALESCE((SELECT SUM(r.headcount) FROM rsvp_responses r WHERE r.event_id = ${eventIdExpr} AND r.status = 'attending'${excludeClause}), 0) + ${walkInCountSql(eventIdExpr)})`;
}

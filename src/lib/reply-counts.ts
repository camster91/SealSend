import { awaitingReplyCountSql } from "./event-stats";

/** Invited people still to answer, as a scalar subquery for a query on `events`. Walk-ins are 'attending' with no reply on file. */
export const noReplyCountSql = awaitingReplyCountSql("events.id");

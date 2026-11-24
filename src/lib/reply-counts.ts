/** Invited people still to answer, as a scalar subquery for a query on `events`. Walk-ins are 'attending' with no reply on file. */
export const noReplyCountSql = `(SELECT COUNT(*) FROM guests g
        WHERE g.event_id = events.id AND g.parent_guest_id IS NULL
          AND COALESCE(g.rsvp_status, 'pending') = 'pending'
          AND NOT EXISTS (SELECT 1 FROM rsvp_responses r WHERE r.event_id = events.id AND r.guest_id = g.id))`;

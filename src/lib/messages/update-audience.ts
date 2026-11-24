import type { MessageAudience } from "./audience";

export type UpdateAudience = "everyone" | "yes" | "waiting";

export function audienceFor(choice: UpdateAudience): MessageAudience {
  return {
    rsvpStatuses: choice === "yes" ? ["attending"] : [],
    invitationStatuses: [],
    tagIds: [],
    unansweredOnly: choice === "waiting",
  };
}

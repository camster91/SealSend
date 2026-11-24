export type ReplyGroup = "yes" | "no" | "maybe" | "waiting";

export function replyGroup(status: string | null | undefined): ReplyGroup {
  if (status === "attending") return "yes";
  if (status === "not_attending") return "no";
  if (status === "maybe") return "maybe";
  return "waiting";
}

export function replyCounts(statuses: Array<string | null | undefined>): Record<ReplyGroup | "all", number> {
  const counts = { all: statuses.length, yes: 0, no: 0, maybe: 0, waiting: 0 };
  for (const status of statuses) counts[replyGroup(status)] += 1;
  return counts;
}

export function announcementOutcome(status: string, sentCount: number): { ok: boolean; title: string; detail: string } {
  const guests = `${sentCount} guest${sentCount === 1 ? "" : "s"}`;
  if (status === "queued" || status === "processing") {
    return { ok: true, title: "Update scheduled", detail: "It will be sent to your chosen guests." };
  }
  if (status === "sent" && sentCount > 0) return { ok: true, title: "Update sent", detail: `Sent to ${guests}.` };
  if (status === "partially_failed" && sentCount > 0) {
    return { ok: false, title: "Some guests didn't get it", detail: `Sent to ${guests}. The rest failed.` };
  }
  return { ok: false, title: "Your update wasn't sent", detail: "No guests received it. Please try again." };
}

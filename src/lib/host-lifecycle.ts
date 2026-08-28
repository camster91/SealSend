import { escapeHtml } from "@/lib/utils";

export type HostLifecycleCandidate = {
  user_id: string;
  email: string;
  event_id: string | null;
  title: string | null;
  notification_type: "getting_started" | "finish_draft" | "event_approaching" | "post_event_repeat" | "stale_draft_warning";
  scope_key: string;
  action_at?: string | null;
};

export function buildHostLifecycleMessage(candidate: HostLifecycleCandidate, siteOverride?: string) {
  const site = (siteOverride || process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app").replace(/\/$/, "");
  if (candidate.notification_type === "getting_started") return {
    subject: "Create your first SealSend event",
    text: `Your workspace is ready. Create an event at ${site}/events/new`,
    html: `<p>Your workspace is ready.</p><p><a href="${site}/events/new">Create your first event</a></p>`,
  };
  const title = escapeHtml(candidate.title || "your event");
  const href = `${site}/events/${candidate.event_id}`;
  if (candidate.notification_type === "finish_draft") return {
    subject: `Finish setting up ${candidate.title || "your event"}`,
    text: `Your event is still a draft. Review it at ${href}`,
    html: `<p><strong>${title}</strong> is still a draft.</p><p><a href="${href}">Review event</a></p>`,
  };
  if (candidate.notification_type === "stale_draft_warning") {
    const actionDate = candidate.action_at
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(candidate.action_at))
      : "the scheduled cleanup date";
    const editHref = `${href}/edit`;
    return {
      subject: `Draft cleanup warning: ${candidate.title || "your event"}`,
      text: `${candidate.title || "Your event"} will become eligible for cleanup on ${actionDate}. Review and save the draft at ${editHref} to keep it active.`,
      html: `<p><strong>${title}</strong> will become eligible for cleanup on ${actionDate}.</p><p><a href="${editHref}">Review and save this draft</a> to keep it active.</p>`,
    };
  }
  if (candidate.notification_type === "post_event_repeat") {
    const analyticsHref = `${site}/events/${candidate.event_id}/analytics`;
    return {
      subject: `Review ${candidate.title || "your event"} and plan what comes next`,
      text: `Review outcomes at ${analyticsHref}. When you are ready, use Repeat event at ${href} to create a fresh draft with a new schedule.`,
      html: `<p><strong>${title}</strong> has ended.</p><p><a href="${analyticsHref}">Review outcomes</a></p><p><a href="${href}">Repeat event</a> to create a fresh draft with a new schedule.</p>`,
    };
  }
  return {
    subject: `${candidate.title || "Your event"} is approaching`,
    text: `Review guests, responses, and check-in readiness at ${href}`,
    html: `<p><strong>${title}</strong> is approaching.</p><p><a href="${href}">Review guests and check-in readiness</a></p>`,
  };
}

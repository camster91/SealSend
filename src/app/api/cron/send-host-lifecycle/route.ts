import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/utils";

type Candidate = {
  user_id: string;
  email: string;
  event_id: string | null;
  title: string | null;
  notification_type: "getting_started" | "finish_draft" | "event_approaching";
  scope_key: string;
};

function content(candidate: Candidate) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app").replace(/\/$/, "");
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
  return {
    subject: `${candidate.title || "Your event"} is approaching`,
    text: `Review guests, responses, and check-in readiness at ${href}`,
    html: `<p><strong>${title}</strong> is approaching.</p><p><a href="${href}">Review guests and check-in readiness</a></p>`,
  };
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const candidates = await query<Candidate>(
    `SELECT * FROM (
      SELECT a.id AS user_id, a.email, NULL::uuid AS event_id, NULL::text AS title,
             'getting_started'::text AS notification_type, 'getting_started:' || a.id::text AS scope_key
        FROM admin_users a
       WHERE a.created_at < NOW() - INTERVAL '24 hours'
         AND NOT EXISTS (SELECT 1 FROM events e WHERE e.user_id = a.id)
      UNION ALL
      SELECT a.id, a.email, e.id, e.title, 'finish_draft', 'finish_draft:' || e.id::text
        FROM admin_users a JOIN events e ON e.user_id = a.id
       WHERE e.status = 'draft' AND e.updated_at < NOW() - INTERVAL '48 hours'
      UNION ALL
      SELECT a.id, a.email, e.id, e.title, 'event_approaching', 'event_approaching:' || e.id::text
        FROM admin_users a JOIN events e ON e.user_id = a.id
       WHERE e.status = 'published' AND e.event_date > NOW() + INTERVAL '2 days'
         AND e.event_date <= NOW() + INTERVAL '3 days'
    ) c WHERE NOT EXISTS (SELECT 1 FROM host_lifecycle_notifications n WHERE n.scope_key = c.scope_key)
    ORDER BY notification_type, scope_key LIMIT 25`,
  );
  if (process.env.ENABLE_HOST_LIFECYCLE_EMAILS !== "true") {
    return NextResponse.json({ enabled: false, candidates: candidates.length, sent: 0 });
  }
  let sent = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      const message = content(candidate);
      const result = await sendEmail({ to: candidate.email, ...message });
      await query(
        `INSERT INTO host_lifecycle_notifications (user_id, event_id, notification_type, scope_key, provider_message_id)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (scope_key) DO NOTHING`,
        [candidate.user_id, candidate.event_id, candidate.notification_type, candidate.scope_key, result.id],
      );
      sent += 1;
    } catch (error) {
      console.error("[host-lifecycle] Controlled send failed", error);
      failed += 1;
    }
  }
  return NextResponse.json({ enabled: true, candidates: candidates.length, sent, failed });
}

export const POST = GET;

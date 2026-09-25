import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { query, queryOne } from "@/lib/db/client";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";

export async function GET() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;

  const userId = auth.user.id;
  const account = await queryOne<{ id: string; email: string; name: string | null; created_at: string }>(
    "SELECT id, email, name, created_at FROM admin_users WHERE id = $1",
    [userId],
  );
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const events = await query<Record<string, unknown>>(
    `SELECT id, title, slug, description, event_date, event_end_date, event_timezone,
            location_name, location_address, host_name, dress_code, rsvp_deadline,
            status, tier, organization_id, repeated_from_event_id, created_at, updated_at
       FROM events WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  const eventIds = events.map((event) => event.id as string);
  const related = eventIds.length === 0 ? { guests: [], responses: [], comments: [], signupClaims: [] } : {
    guests: await query("SELECT id, event_id, name, email, phone, invite_status, rsvp_status, notes, tags, created_at FROM guests WHERE event_id = ANY($1::uuid[]) ORDER BY created_at", [eventIds]),
    responses: await query("SELECT id, event_id, respondent_name, respondent_email, status, headcount, response_data, plus_ones_data, submitted_at FROM rsvp_responses WHERE event_id = ANY($1::uuid[]) ORDER BY submitted_at", [eventIds]),
    comments: await query("SELECT id, event_id, author_name, message, is_private, created_at FROM event_comments WHERE event_id = ANY($1::uuid[]) ORDER BY created_at", [eventIds]),
    signupClaims: await query("SELECT id, event_id, claimant_name, claimant_email, created_at FROM event_signup_claims WHERE event_id = ANY($1::uuid[]) ORDER BY created_at", [eventIds]),
  };
  const organizations = await query(
    `SELECT o.id, o.name, o.plan, o.is_personal, m.role, m.created_at AS joined_at
       FROM organization_members m JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = $1 ORDER BY m.created_at`,
    [userId],
  );
  await recordActivationEventSafely({ name: "account_exported", userId });

  return NextResponse.json(
    { exportedAt: new Date().toISOString(), account, organizations, events, ...related },
    { headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="sealsend-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "X-Content-Type-Options": "nosniff",
    } },
  );
}

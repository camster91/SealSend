import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { requireOrganizationPermission } from "@/lib/auth/organization-access";
import {
  MAX_WEBHOOKS_PER_ORGANIZATION,
  WEBHOOK_EVENT_TYPES,
  canUseWebhooks,
  generateWebhookSecret,
  webhookInputSchema,
  webhookUrlProblem,
} from "@/lib/webhooks";

type RouteParams = { params: Promise<{ organizationId: string }> };

const WEBHOOK_COLUMNS = `id, url, events, description, active, last_success_at, last_failure_at, consecutive_failures, created_at,
  'whsec_…' || right(secret, 4) AS secret_preview`;

async function loadPlan(organizationId: string) {
  return (await queryOne<{ plan: string }>("SELECT plan FROM organizations WHERE id = $1", [organizationId]))?.plan ?? "personal";
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_integrations");
  if (auth.error) return auth.error;
  const [webhooks, deliveries, plan] = await Promise.all([
    query(`SELECT ${WEBHOOK_COLUMNS} FROM organization_webhooks WHERE organization_id = $1 ORDER BY created_at`, [organizationId]),
    query(
      `SELECT d.id, d.webhook_id, d.event_type, d.status, d.attempts, d.last_status_code, d.last_error, d.created_at, d.delivered_at
         FROM webhook_deliveries d JOIN organization_webhooks w ON w.id = d.webhook_id
        WHERE w.organization_id = $1 ORDER BY d.created_at DESC LIMIT 20`,
      [organizationId],
    ),
    loadPlan(organizationId),
  ]);
  return NextResponse.json(
    { webhooks, deliveries, available: canUseWebhooks(plan), eventTypes: WEBHOOK_EVENT_TYPES, limit: MAX_WEBHOOKS_PER_ORGANIZATION },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Creates an endpoint. The signing secret is returned once, here, and never again. */
export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_integrations");
  if (auth.error) return auth.error;
  if (!canUseWebhooks(await loadPlan(organizationId))) {
    return NextResponse.json({ error: "Webhooks are available on organizer plans." }, { status: 403 });
  }
  const parsed = webhookInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the webhook details" }, { status: 400 });
  const problem = webhookUrlProblem(parsed.data.url);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const secret = generateWebhookSecret();
  const [webhook] = await query(
    `INSERT INTO organization_webhooks (organization_id, url, secret, events, description, created_by)
     SELECT $1, $2, $3, $4, $5, $6
      WHERE (SELECT COUNT(*) FROM organization_webhooks WHERE organization_id = $1) < $7
     RETURNING ${WEBHOOK_COLUMNS}`,
    [organizationId, parsed.data.url, secret, [...new Set(parsed.data.events)], parsed.data.description, auth.user.id, MAX_WEBHOOKS_PER_ORGANIZATION],
  );
  if (!webhook) {
    return NextResponse.json({ error: `A workspace can have up to ${MAX_WEBHOOKS_PER_ORGANIZATION} webhooks.` }, { status: 409 });
  }
  return NextResponse.json({ webhook, secret }, { status: 201 });
}

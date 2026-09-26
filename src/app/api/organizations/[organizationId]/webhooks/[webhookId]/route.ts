import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { requireOrganizationPermission } from "@/lib/auth/organization-access";
import { webhookUpdateSchema } from "@/lib/webhooks";

type RouteParams = { params: Promise<{ organizationId: string; webhookId: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

/** Pause or resume an endpoint, or change the events it receives. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { organizationId, webhookId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_integrations");
  if (auth.error) return auth.error;
  if (!UUID.test(webhookId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = webhookUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the webhook details" }, { status: 400 });
  const [webhook] = await query(
    `UPDATE organization_webhooks
        SET active = COALESCE($3, active),
            events = COALESCE($4, events),
            consecutive_failures = CASE WHEN $3 IS TRUE THEN 0 ELSE consecutive_failures END
      WHERE id = $1 AND organization_id = $2
      RETURNING id, active, events`,
    [webhookId, organizationId, parsed.data.active ?? null, parsed.data.events ? [...new Set(parsed.data.events)] : null],
  );
  if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ webhook });
}

/** Deleting an endpoint also drops its queued and past deliveries. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { organizationId, webhookId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_integrations");
  if (auth.error) return auth.error;
  if (!UUID.test(webhookId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const removed = await query("DELETE FROM organization_webhooks WHERE id = $1 AND organization_id = $2 RETURNING id", [webhookId, organizationId]);
  if (removed.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

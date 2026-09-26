import { NextResponse } from "next/server";
import { requireOrganizationPermission } from "@/lib/auth/organization-access";
import { rateLimit } from "@/lib/rate-limit";
import { sendTestWebhook } from "@/lib/webhooks";

type RouteParams = { params: Promise<{ organizationId: string; webhookId: string }> };

/** Sends a signed `webhook.test` event now and reports what the endpoint answered. */
export async function POST(_request: Request, { params }: RouteParams) {
  const { organizationId, webhookId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_integrations");
  if (auth.error) return auth.error;
  if (!/^[0-9a-f-]{36}$/i.test(webhookId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { success } = await rateLimit(`webhook-test:${auth.user.id}`, { max: 10, windowSeconds: 600 });
  if (!success) return NextResponse.json({ error: "Too many test sends. Try again in a few minutes." }, { status: 429 });
  const result = await sendTestWebhook(webhookId, organizationId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}

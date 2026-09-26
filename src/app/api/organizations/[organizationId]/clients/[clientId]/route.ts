import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { requireOrganizationPermission } from "@/lib/auth/organization-access";
import { CLIENT_HISTORY_CSV_HEADER, clientHistoryCsvRows, clientInputSchema, getClientEventHistory } from "@/lib/clients";
import { toCsv } from "@/lib/csv";

type RouteParams = { params: Promise<{ organizationId: string; clientId: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

/** One client with their event history; `?format=csv` downloads the history. */
export async function GET(request: Request, { params }: RouteParams) {
  const { organizationId, clientId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_clients");
  if (auth.error) return auth.error;
  if (!UUID.test(clientId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const client = await queryOne<{ id: string; name: string }>(
    `SELECT id, name, contact_email, contact_phone, notes, created_at FROM clients WHERE id = $1 AND organization_id = $2`,
    [clientId, organizationId],
  );
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const events = await getClientEventHistory(organizationId, clientId);

  if (new URL(request.url).searchParams.get("format") === "csv") {
    const slug = client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
    return new NextResponse(toCsv(CLIENT_HISTORY_CSV_HEADER, clientHistoryCsvRows(events)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-events.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return NextResponse.json({ client, events }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { organizationId, clientId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_clients");
  if (auth.error) return auth.error;
  if (!UUID.test(clientId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = clientInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the client details" }, { status: 400 });
  const [client] = await query(
    `UPDATE clients SET name = $3, contact_email = $4, contact_phone = $5, notes = $6, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING id, name, contact_email, contact_phone, notes, created_at`,
    [clientId, organizationId, parsed.data.name, parsed.data.contactEmail ?? null, parsed.data.contactPhone ?? null, parsed.data.notes ?? null],
  );
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ client });
}

/** Deleting a client keeps its events; they simply have no client any more. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { organizationId, clientId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_clients");
  if (auth.error) return auth.error;
  if (!UUID.test(clientId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const removed = await query("DELETE FROM clients WHERE id = $1 AND organization_id = $2 RETURNING id", [clientId, organizationId]);
  if (removed.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

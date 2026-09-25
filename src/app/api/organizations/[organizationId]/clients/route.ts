import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { requireOrganizationPermission } from "@/lib/auth/organization-access";
import { clientInputSchema } from "@/lib/clients";

type RouteParams = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_clients");
  if (auth.error) return auth.error;
  const clients = await query(
    `SELECT c.id, c.name, c.contact_email, c.contact_phone, c.notes, c.created_at,
            (SELECT COUNT(*) FROM events e WHERE e.client_id = c.id)::int AS event_count
       FROM clients c WHERE c.organization_id = $1 ORDER BY LOWER(c.name)`,
    [organizationId],
  );
  return NextResponse.json({ clients }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_clients");
  if (auth.error) return auth.error;
  const parsed = clientInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the client details" }, { status: 400 });
  const [client] = await query(
    `INSERT INTO clients (organization_id, name, contact_email, contact_phone, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, contact_email, contact_phone, notes, created_at`,
    [organizationId, parsed.data.name, parsed.data.contactEmail ?? null, parsed.data.contactPhone ?? null, parsed.data.notes ?? null],
  );
  return NextResponse.json({ client }, { status: 201 });
}

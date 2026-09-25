import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { requireOrganizationPermission } from "@/lib/auth/organization-access";
import { brandInputSchema, canWhiteLabel, toBrandColumns, type Brand } from "@/lib/brands";

type RouteParams = { params: Promise<{ organizationId: string }> };

async function loadBrand(organizationId: string) {
  return queryOne<Brand>("SELECT * FROM brands WHERE organization_id = $1 AND is_default", [organizationId]);
}

async function loadPlan(organizationId: string) {
  return (await queryOne<{ plan: string }>("SELECT plan FROM organizations WHERE id = $1", [organizationId]))?.plan ?? "personal";
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "view_organization");
  if (auth.error) return auth.error;
  const plan = await loadPlan(organizationId);
  return NextResponse.json(
    { brand: await loadBrand(organizationId), whiteLabelAvailable: canWhiteLabel(plan), canEdit: auth.role === "owner" || auth.role === "admin" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_brand");
  if (auth.error) return auth.error;

  const parsed = brandInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the brand details" }, { status: 400 });
  }
  const columns = toBrandColumns(parsed.data);
  if (parsed.data.logoUrl && !columns.logo_url) {
    return NextResponse.json({ error: "Use an https:// logo URL or an uploaded image" }, { status: 400 });
  }
  // White-label is stored as requested but only takes effect on organizer plans (see toEventBranding).
  const existing = await loadBrand(organizationId);
  const values = [columns.name, columns.logo_url, columns.primary_color, columns.background_color, columns.font_family,
    columns.sender_name, columns.reply_to_email, columns.sms_signature, columns.white_label];
  const [brand] = existing
    ? await query<Brand>(
        `UPDATE brands SET name = $2, logo_url = $3, primary_color = $4, background_color = $5, font_family = $6,
           sender_name = $7, reply_to_email = $8, sms_signature = $9, white_label = $10, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [existing.id, ...values],
      )
    : await query<Brand>(
        `INSERT INTO brands (organization_id, name, logo_url, primary_color, background_color, font_family,
           sender_name, reply_to_email, sms_signature, white_label, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE) RETURNING *`,
        [organizationId, ...values],
      );
  return NextResponse.json({ brand });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_brand");
  if (auth.error) return auth.error;
  await query("DELETE FROM brands WHERE organization_id = $1 AND is_default", [organizationId]);
  return NextResponse.json({ brand: null });
}

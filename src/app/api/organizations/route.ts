import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getDb } from "@/lib/db/client";
import { ensurePersonalOrganization, listUserOrganizations } from "@/lib/auth/organization-access";
import { rateLimit } from "@/lib/rate-limit";

const MAX_TEAM_WORKSPACES_PER_HOST = 5;
const createSchema = z.object({ name: z.string().trim().min(1, "Workspace name is required").max(120) }).strict();

/** Workspaces the signed-in host belongs to, personal workspace first. */
export async function GET() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  await ensurePersonalOrganization(auth.user.id);
  const organizations = await listUserOrganizations(auth.user.id);
  return NextResponse.json({ organizations }, { headers: { "Cache-Control": "no-store" } });
}

/** Creates a team workspace owned by the signed-in host. */
export async function POST(request: Request) {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const { success } = await rateLimit(`create-workspace:${auth.user.id}`, { max: 10, windowSeconds: 3600 });
  if (!success) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });

  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`workspaces:${auth.user.id}`]);
    const owned = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM organizations WHERE created_by = $1 AND NOT is_personal",
      [auth.user.id],
    );
    if (Number(owned.rows[0]?.count ?? 0) >= MAX_TEAM_WORKSPACES_PER_HOST) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: `You can create up to ${MAX_TEAM_WORKSPACES_PER_HOST} team workspaces.` }, { status: 403 });
    }
    const created = await client.query<{ id: string; name: string }>(
      `INSERT INTO organizations (name, slug, created_by)
       VALUES ($1, 'team-' || REPLACE(gen_random_uuid()::text, '-', ''), $2)
       RETURNING id, name`,
      [parsed.data.name, auth.user.id],
    );
    const organization = created.rows[0];
    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')",
      [organization.id, auth.user.id],
    );
    await client.query("COMMIT");
    return NextResponse.json({ organization: { ...organization, plan: "personal", is_personal: false, role: "owner" } }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

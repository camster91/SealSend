import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiHost } from "@/lib/auth/api-auth";
import { batch } from "@/lib/db/client";
import { abortCode, guard } from "@/lib/db/sqlite-dialect";
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

  const organization = { id: crypto.randomUUID(), name: parsed.data.name };
  const slug = `team-${crypto.randomUUID().replace(/-/g, "")}`;
  try {
    // The count guard runs inside the batch, so parallel requests can't pass the limit together.
    await batch([
      guard(
        "(SELECT COUNT(*) FROM organizations WHERE created_by = $1 AND is_personal = 0) < $2",
        [auth.user.id, MAX_TEAM_WORKSPACES_PER_HOST],
        "workspace_limit",
      ),
      {
        text: "INSERT INTO organizations (id, name, slug, created_by) VALUES ($1, $2, $3, $4)",
        params: [organization.id, organization.name, slug, auth.user.id],
      },
      {
        text: "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')",
        params: [organization.id, auth.user.id],
      },
    ]);
  } catch (error) {
    if (abortCode(error) === "workspace_limit") {
      return NextResponse.json({ error: `You can create up to ${MAX_TEAM_WORKSPACES_PER_HOST} team workspaces.` }, { status: 403 });
    }
    throw error;
  }
  return NextResponse.json({ organization: { ...organization, plan: "personal", is_personal: false, role: "owner" } }, { status: 201 });
}

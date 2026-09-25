import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { ensurePersonalOrganization, listUserOrganizations } from "@/lib/auth/organization-access";

/** Workspaces the signed-in host belongs to, personal workspace first. */
export async function GET() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  await ensurePersonalOrganization(auth.user.id);
  const organizations = await listUserOrganizations(auth.user.id);
  return NextResponse.json({ organizations }, { headers: { "Cache-Control": "no-store" } });
}

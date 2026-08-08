import { NextResponse } from "next/server";
import { requireApiHost, type AuthenticatedUser } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan, type EventAccess, type EventPermission } from "@/lib/auth/event-access";

export async function requireEventPermission(eventId: string, permission: EventPermission): Promise<
  { user: AuthenticatedUser; access: EventAccess; error?: undefined }
  | { user?: undefined; access?: undefined; error: NextResponse }
> {
  const auth = await requireApiHost();
  if (auth.error) return { error: auth.error };
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, permission)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { user: auth.user, access };
}

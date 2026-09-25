import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { WorkspaceTeamSettings } from "@/components/settings/WorkspaceTeamSettings";

export const metadata: Metadata = { title: "Team - SealSend" };

export default async function TeamSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/settings/team");
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <Link href="/settings" className="text-sm text-brand-700 hover:underline">← Settings</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Team</h1>
      </div>
      <WorkspaceTeamSettings currentUserId={user.id} />
    </div>
  );
}

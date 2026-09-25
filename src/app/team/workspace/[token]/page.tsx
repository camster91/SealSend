import { AcceptWorkspaceInvite } from "@/components/team/AcceptWorkspaceInvite";

export default async function WorkspaceInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md"><AcceptWorkspaceInvite token={token} /></div>
    </main>
  );
}

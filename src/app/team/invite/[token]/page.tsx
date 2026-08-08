import { AcceptTeamInvite } from "@/components/team/AcceptTeamInvite";

export default async function TeamInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4"><div className="w-full max-w-md"><AcceptTeamInvite token={token} /></div></main>;
}

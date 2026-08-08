"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "manager" | "check_in" | "viewer";
type Member = { id: string; email: string; name: string | null; role: Role };
type Invite = { id: string; email: string; role: Role; expires_at: string };

export function EventTeamPanel({ eventId }: { eventId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/events/${eventId}/members`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setMembers(data.members ?? []);
    setInvites(data.invites ?? []);
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const response = await fetch(`/api/events/${eventId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await response.json();
    if (!response.ok) setStatus(data.error ?? "Invitation failed.");
    else {
      setEmail("");
      setStatus(data.delivery === "sent" ? "Invitation sent." : `Email delivery is unavailable. Copy this test invite link: ${data.inviteUrl}`);
      await load();
    }
    setBusy(false);
  }

  async function updateMember(memberId: string, nextRole: Role) {
    const response = await fetch(`/api/events/${eventId}/members/${memberId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: nextRole }),
    });
    setStatus(response.ok ? "Role updated." : "Role update failed.");
    await load();
  }

  async function removeMember(memberId: string) {
    const response = await fetch(`/api/events/${eventId}/members/${memberId}`, { method: "DELETE" });
    setStatus(response.ok ? "Team member removed." : "Removal failed.");
    await load();
  }

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="event-team-title">
      <h2 id="event-team-title" className="text-base font-semibold text-gray-900">Event team</h2>
      <p className="mt-1 text-sm text-gray-500">Invite collaborators with only the access they need.</p>
      <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
        <label className="sr-only" htmlFor="team-email">Email address</label>
        <input id="team-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" className="h-11 rounded-xl border border-gray-300 px-3 text-sm" />
        <label className="sr-only" htmlFor="team-role">Role</label>
        <select id="team-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-11 rounded-xl border border-gray-300 px-3 text-sm">
          <option value="manager">Manager</option><option value="check_in">Check-in</option><option value="viewer">Viewer</option>
        </select>
        <button disabled={busy} className="h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Inviting…" : "Invite"}</button>
      </form>
      {status && <p role="status" className="mt-3 break-all rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{status}</p>}
      {(members.length > 0 || invites.length > 0) && <div className="mt-5 space-y-3">
        {members.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.name || member.email}</p><p className="truncate text-xs text-gray-500">{member.email}</p></div>
          <select aria-label={`Role for ${member.email}`} value={member.role} onChange={(e) => void updateMember(member.id, e.target.value as Role)} className="h-10 rounded-lg border border-gray-300 px-2 text-sm"><option value="manager">Manager</option><option value="check_in">Check-in</option><option value="viewer">Viewer</option></select>
          <button onClick={() => void removeMember(member.id)} className="h-10 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50">Remove</button>
        </div>)}
        {invites.map((invite) => <div key={invite.id} className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm"><span className="truncate">{invite.email}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">Pending · {invite.role.replace("_", "-")}</span></div>)}
      </div>}
    </section>
  );
}

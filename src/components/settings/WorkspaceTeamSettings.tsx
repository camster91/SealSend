"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Organization = { id: string; name: string; plan: string; is_personal: boolean; role: string };
type Member = { user_id: string; email: string; name: string | null; role: string };
type Invite = { id: string; email: string; role: string; expires_at: string };
type MembersResponse = {
  organization: { name: string; plan: string; is_personal: boolean } | null;
  members: Member[];
  invites: Invite[];
  viewerRole: string;
  seatLimit: number;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  planner: "Planner",
  check_in: "Check-in staff",
};
const ROLE_HELP: Record<string, string> = {
  owner: "Everything, including billing and the workspace itself",
  admin: "Manages members, brand and every event",
  planner: "Creates and runs events",
  check_in: "Checks guests in at the door",
};

function canManage(viewerRole: string, targetRole: string) {
  if (viewerRole === "owner") return true;
  return viewerRole === "admin" && (targetRole === "planner" || targetRole === "check_in");
}

export function WorkspaceTeamSettings({ currentUserId }: { currentUserId: string }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [data, setData] = useState<MembersResponse | null>(null);
  const [newWorkspace, setNewWorkspace] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("planner");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadOrganizations = useCallback(async (selectId?: string) => {
    const res = await fetch("/api/organizations");
    const body: { organizations: Organization[] } = res.ok ? await res.json() : { organizations: [] };
    setOrganizations(body.organizations);
    setOrganizationId((current) => selectId ?? current ?? body.organizations.find((o) => !o.is_personal)?.id ?? body.organizations[0]?.id ?? null);
  }, []);

  const loadMembers = useCallback(async (id: string) => {
    const res = await fetch(`/api/organizations/${id}/members`);
    setData(res.ok ? await res.json() : null);
  }, []);

  useEffect(() => { void loadOrganizations(); }, [loadOrganizations]);
  useEffect(() => { if (organizationId) void loadMembers(organizationId); }, [organizationId, loadMembers]);

  async function run(action: () => Promise<Response>, success: string, after?: (body: Record<string, unknown>) => Promise<void> | void) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await action();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: body.error || "Something went wrong. Please try again." });
        return;
      }
      setMessage({ type: "success", text: success });
      await after?.(body);
    } finally {
      setBusy(false);
    }
  }

  const json = (method: string, payload?: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  const selected = organizations.find((organization) => organization.id === organizationId) ?? null;
  const viewerRole = data?.viewerRole ?? "";
  const managesMembers = viewerRole === "owner" || viewerRole === "admin";
  const seatsUsed = (data?.members.length ?? 0) + (data?.invites.length ?? 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Workspaces</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            A team workspace lets planners and check-in staff work on the same events under one brand. Your personal workspace is just for you.
          </p>
          {organizations.length > 0 && (
            <label className="block text-sm font-medium text-gray-700">
              Workspace
              <select
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                value={organizationId ?? ""}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}{organization.is_personal ? " (personal)" : ""} · {ROLE_LABELS[organization.role] ?? organization.role}
                  </option>
                ))}
              </select>
            </label>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () => fetch("/api/organizations", json("POST", { name: newWorkspace })),
                "Team workspace created. Invite your team below.",
                async (body) => {
                  setNewWorkspace("");
                  await loadOrganizations((body.organization as Organization).id);
                },
              );
            }}
          >
            <div className="min-w-0 flex-1">
              <Input label="New team workspace" value={newWorkspace} onChange={(event) => setNewWorkspace(event.target.value)} placeholder="Bloom Events" maxLength={120} />
            </div>
            <Button type="submit" disabled={busy || !newWorkspace.trim()}>Create</Button>
          </form>
        </CardContent>
      </Card>

      {selected && data && (
        <Card>
          <CardHeader><CardTitle>{selected.name} team</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {!selected.is_personal && ["owner", "admin", "planner"].includes(viewerRole) && (
              <Link href={`/events/new?workspace=${selected.id}`} className="inline-flex text-sm font-medium text-brand-700 hover:underline">
                Create an event in this workspace →
              </Link>
            )}

            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {data.members.map((member) => {
                const self = member.user_id === currentUserId;
                const editable = !self && canManage(viewerRole, member.role);
                return (
                  <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{member.name || member.email}{self ? " (you)" : ""}</p>
                      {member.name && <p className="truncate text-gray-500">{member.email}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {editable ? (
                        <select
                          aria-label={`Role for ${member.email}`}
                          className="rounded-lg border border-gray-300 px-2 py-1"
                          value={member.role}
                          disabled={busy}
                          onChange={(event) => void run(
                            () => fetch(`/api/organizations/${selected.id}/members/${member.user_id}`, json("PATCH", { role: event.target.value })),
                            "Role updated.",
                            () => loadMembers(selected.id),
                          )}
                        >
                          {Object.entries(ROLE_LABELS)
                            .filter(([role]) => canManage(viewerRole, role))
                            .map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                        </select>
                      ) : (
                        <span className="text-gray-600" title={ROLE_HELP[member.role]}>{ROLE_LABELS[member.role] ?? member.role}</span>
                      )}
                      {(editable || (self && !selected.is_personal)) && (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          aria-label={self ? "Leave workspace" : `Remove ${member.email}`}
                          onClick={() => void run(
                            () => fetch(`/api/organizations/${selected.id}/members/${member.user_id}`, json("DELETE")),
                            self ? "You left the workspace." : "Member removed.",
                            async () => {
                              if (self) { setOrganizationId(null); await loadOrganizations(); }
                              else await loadMembers(selected.id);
                            },
                          )}
                        >
                          {self ? "Leave" : "Remove"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {managesMembers && !selected.is_personal && (
              <>
                <form
                  className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(
                      () => fetch(`/api/organizations/${selected.id}/members`, json("POST", { email: inviteEmail, role: inviteRole })),
                      "Invitation sent. It expires in seven days.",
                      async () => { setInviteEmail(""); await loadMembers(selected.id); },
                    );
                  }}
                >
                  <Input label="Invite by email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="planner@example.com" required />
                  <select aria-label="Role for new member" className="h-10 rounded-lg border border-gray-300 px-2" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                    {["admin", "planner", "check_in"].filter((role) => canManage(viewerRole, role)).map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                  <Button type="submit" disabled={busy || !inviteEmail}>Invite</Button>
                </form>
                <p className="text-xs text-gray-500">{seatsUsed} of {data.seatLimit} seats used, including pending invitations.</p>

                {data.invites.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">Pending invitations</h3>
                    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                      {data.invites.map((invite) => (
                        <li key={invite.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span className="truncate">{invite.email} · {ROLE_LABELS[invite.role] ?? invite.role}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            aria-label={`Revoke invitation for ${invite.email}`}
                            onClick={() => void run(
                              () => fetch(`/api/organizations/${selected.id}/invites/${invite.id}`, json("DELETE")),
                              "Invitation revoked.",
                              () => loadMembers(selected.id),
                            )}
                          >
                            Revoke
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {selected.is_personal && (
              <p className="text-sm text-gray-500">Personal workspaces have one member. Create a team workspace above to work with others.</p>
            )}
          </CardContent>
        </Card>
      )}

      {message && (
        <p role={message.type === "error" ? "alert" : "status"} className={message.type === "error" ? "text-sm text-red-700" : "text-sm text-green-700"}>
          {message.text}
        </p>
      )}
    </div>
  );
}

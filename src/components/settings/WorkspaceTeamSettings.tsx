"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Feedback";
import { BETA_MODE, ORGANIZER_PLANS, type OrganizerPlan } from "@/lib/constants";

type Organization = { id: string; name: string; plan: string; is_personal: boolean; role: string };
type Member = { user_id: string; email: string; name: string | null; role: string };
type Invite = { id: string; email: string; role: string; expires_at: string };
type WorkspaceSubscription = { plan: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };
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

const PLAN_LABELS: Record<string, string> = {
  personal: "Free",
  ...Object.fromEntries(Object.entries(ORGANIZER_PLANS).map(([id, plan]) => [id, plan.name])),
};

function formatMonthly(cents: number) {
  return `$${(cents / 100).toFixed(0)}/mo`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;
}

function subscriptionSummary(subscription: WorkspaceSubscription) {
  const date = formatDate(subscription.currentPeriodEnd);
  if (subscription.status === "past_due") return "The last payment failed, so paid features are paused until Stripe collects it.";
  if (subscription.cancelAtPeriodEnd) return date ? `Cancels on ${date}. Paid features stay on until then.` : "Cancels at the end of this billing period.";
  return date ? `Renews on ${date}.` : null;
}

export function WorkspaceTeamSettings({ currentUserId }: { currentUserId: string }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [data, setData] = useState<MembersResponse | null>(null);
  const [newWorkspace, setNewWorkspace] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("planner");
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
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

  const [subscription, setSubscription] = useState<WorkspaceSubscription | null>(null);

  const loadSubscription = useCallback(async (id: string) => {
    const res = await fetch(`/api/organizations/${id}/billing/subscription`);
    const body: { subscription: WorkspaceSubscription | null } = res.ok ? await res.json() : { subscription: null };
    setSubscription(body.subscription);
  }, []);

  useEffect(() => { void loadOrganizations(); }, [loadOrganizations]);
  useEffect(() => { if (organizationId) void loadMembers(organizationId); }, [organizationId, loadMembers]);
  useEffect(() => {
    setSubscription(null);
    if (!BETA_MODE && organizationId && data?.viewerRole === "owner" && !data.organization?.is_personal) void loadSubscription(organizationId);
  }, [organizationId, data?.viewerRole, data?.organization?.is_personal, loadSubscription]);

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

  async function startCheckout(id: string, plan: OrganizerPlan) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/organizations/${id}/billing/checkout`, json("POST", { plan }));
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.url !== "string") {
        setMessage({ type: "error", text: body.error || "Checkout couldn't start. Please try again." });
        return;
      }
      window.location.assign(body.url);
    } finally {
      setBusy(false);
    }
  }

  // Stripe confirms changes through the webhook, so reload shortly after Stripe accepts them.
  function updateSubscription(id: string, payload: { action: "change"; plan: OrganizerPlan } | { action: "cancel" | "resume" }, success: string) {
    return run(
      () => fetch(`/api/organizations/${id}/billing/subscription`, json("POST", payload)),
      success,
      () => new Promise<void>((resolve) => {
        window.setTimeout(() => {
          void Promise.all([loadMembers(id), loadSubscription(id)]).finally(resolve);
        }, 2500);
      }),
    );
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
                          onClick={async () => {
                            const ok = await confirm(self
                              ? { title: `Leave ${selected.name}?`, description: "You'll lose access to this workspace's events until someone invites you again.", confirmLabel: "Leave workspace" }
                              : { title: `Remove ${member.name || member.email}?`, description: "They'll lose access to this workspace's events right away.", confirmLabel: "Remove member" });
                            if (!ok) return;
                            void run(
                            () => fetch(`/api/organizations/${selected.id}/members/${member.user_id}`, json("DELETE")),
                            self ? "You left the workspace." : "Member removed.",
                            async () => {
                              if (self) { setOrganizationId(null); await loadOrganizations(); }
                              else await loadMembers(selected.id);
                            },
                            );
                          }}
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

      {selected && data && !selected.is_personal && (
        <Card>
          <CardHeader><CardTitle>Workspace plan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700">
              Current plan: <span className="font-semibold">{PLAN_LABELS[data.organization?.plan ?? "personal"] ?? data.organization?.plan}</span> · {data.seatLimit} seats
            </p>
            {BETA_MODE ? (
              <p className="text-sm text-gray-500">Paid workspace plans aren&apos;t available during the controlled beta.</p>
            ) : viewerRole === "owner" ? (
              <>
                {subscription && subscription.status !== "canceled" && subscriptionSummary(subscription) && (
                  <p className="text-sm text-gray-600">{subscriptionSummary(subscription)}</p>
                )}
                <ul className="grid gap-3 sm:grid-cols-3">
                  {(Object.entries(ORGANIZER_PLANS) as [OrganizerPlan, (typeof ORGANIZER_PLANS)[OrganizerPlan]][]).map(([id, plan]) => {
                    const subscribed = subscription !== null && subscription.status !== "canceled";
                    const current = subscribed ? subscription.plan === id : data.organization?.plan === id;
                    return (
                      <li key={id} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 text-sm">
                        <p className="font-semibold text-gray-900">{plan.name}</p>
                        <p className="text-gray-700">{formatMonthly(plan.monthlyPriceCents)} · {plan.seats} seats</p>
                        <Button
                          type="button"
                          disabled={busy || current}
                          onClick={async () => {
                            if (!subscribed) return void startCheckout(selected.id, id);
                            const ok = await confirm({
                              title: `Switch to ${plan.name}?`,
                              description: `${plan.name} is ${formatMonthly(plan.monthlyPriceCents)} with ${plan.seats} seats. Stripe prorates the difference on your next invoice.`,
                              confirmLabel: `Switch to ${plan.name}`,
                            });
                            if (ok) void updateSubscription(selected.id, { action: "change", plan: id }, `Switching to ${plan.name}. This page updates once Stripe confirms.`);
                          }}
                        >
                          {current ? "Current plan" : subscribed ? `Switch to ${plan.name}` : `Choose ${plan.name}`}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                {subscription && subscription.status !== "canceled" && (
                  subscription.cancelAtPeriodEnd ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void updateSubscription(selected.id, { action: "resume" }, "Your plan will keep renewing.")}
                    >
                      Keep my plan
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Cancel the workspace plan?",
                          description: "Paid features stay on until the end of this billing period. After that the workspace moves to the free plan with 2 seats. Events and guests are kept.",
                          confirmLabel: "Cancel plan",
                        });
                        if (ok) void updateSubscription(selected.id, { action: "cancel" }, "Your plan will end at the close of this billing period.");
                      }}
                    >
                      Cancel plan
                    </Button>
                  )
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Only the workspace owner can change the plan.</p>
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

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Organization = { id: string; name: string; is_personal: boolean; role: string };
type Client = { id: string; name: string; contact_email: string | null; contact_phone: string | null; notes: string | null; event_count: number };
type HistoryEvent = {
  id: string;
  title: string;
  eventDate: string | null;
  status: string;
  rsvp: { invited: number; attending: number; maybe: number; declined: number; awaiting: number; headcount: number };
  approvedAt: string | null;
  approverName: string | null;
};

const EMPTY = { name: "", contactEmail: "", contactPhone: "", notes: "" };

export function ClientsSettings() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/organizations")
      .then((res) => (res.ok ? res.json() : { organizations: [] }))
      .then((data: { organizations: Organization[] }) => {
        const manageable = data.organizations.filter((organization) => ["owner", "admin", "planner"].includes(organization.role));
        setOrganizations(manageable);
        setOrganizationId(manageable.find((organization) => !organization.is_personal)?.id ?? manageable[0]?.id ?? null);
      });
  }, []);

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/organizations/${id}/clients`);
    setClients(res.ok ? (await res.json()).clients : []);
  }, []);

  useEffect(() => { if (organizationId) void load(organizationId); }, [organizationId, load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    setBusy(true);
    setMessage(null);
    try {
      const url = editingId ? `/api/organizations/${organizationId}/clients/${editingId}` : `/api/organizations/${organizationId}/clients`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Could not save the client." });
        return;
      }
      setMessage({ type: "success", text: editingId ? "Client updated." : "Client added." });
      setForm(EMPTY);
      setEditingId(null);
      await load(organizationId);
    } finally {
      setBusy(false);
    }
  }

  async function toggleHistory(client: Client) {
    if (!organizationId) return;
    if (historyFor === client.id) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(client.id);
    setHistory(null);
    const res = await fetch(`/api/organizations/${organizationId}/clients/${client.id}`);
    setHistory(res.ok ? (await res.json()).events : []);
  }

  async function remove(client: Client) {
    if (!organizationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/clients/${client.id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: `${client.name} removed. Their events were kept.` });
        await load(organizationId);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Clients</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-gray-600">Keep a record of who you run events for, then assign each event to a client and send them a review link from the event page.</p>

        {organizations.length > 1 && (
          <label className="block text-sm font-medium text-gray-700">
            Workspace
            <select className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" value={organizationId ?? ""} onChange={(event) => setOrganizationId(event.target.value)}>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}{organization.is_personal ? " (personal)" : ""}</option>
              ))}
            </select>
          </label>
        )}

        {clients.length > 0 ? (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {clients.map((client) => (
              <li key={client.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{client.name}</p>
                  <p className="truncate text-gray-500">
                    {[client.contact_email, client.contact_phone].filter(Boolean).join(" · ") || "No contact details"} · {client.event_count} event{client.event_count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-expanded={historyFor === client.id}
                    aria-label={`Event history for ${client.name}`}
                    onClick={() => void toggleHistory(client)}
                  >
                    History
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Edit ${client.name}`}
                    onClick={() => {
                      setEditingId(client.id);
                      setForm({ name: client.name, contactEmail: client.contact_email ?? "", contactPhone: client.contact_phone ?? "", notes: client.notes ?? "" });
                    }}
                  >
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} aria-label={`Remove ${client.name}`} onClick={() => void remove(client)}>Remove</Button>
                </div>
                {historyFor === client.id && (
                  <div className="w-full rounded-lg bg-gray-50 p-3">
                    {history === null ? (
                      <p className="text-gray-500">Loading…</p>
                    ) : history.length === 0 ? (
                      <p className="text-gray-500">No events for this client yet. Assign one from an event&apos;s page.</p>
                    ) : (
                      <>
                        <ul className="space-y-2">
                          {history.map((event) => (
                            <li key={event.id}>
                              <Link href={`/events/${event.id}`} className="font-medium text-brand-700 hover:underline">{event.title}</Link>
                              <span className="text-gray-500">
                                {" "}· {event.eventDate ? new Date(event.eventDate).toLocaleDateString() : "No date"} · {event.status}
                              </span>
                              <p className="text-gray-600">
                                {event.rsvp.attending} attending ({event.rsvp.headcount} people) · {event.rsvp.maybe} maybe · {event.rsvp.declined} declined · {event.rsvp.awaiting} awaiting
                                {event.approvedAt && <> · <span className="text-green-700">approved by {event.approverName}</span></>}
                              </p>
                            </li>
                          ))}
                        </ul>
                        <a
                          href={`/api/organizations/${organizationId}/clients/${client.id}?format=csv`}
                          className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
                        >
                          Download CSV
                        </a>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          organizationId && <p className="text-sm text-gray-500">No clients yet.</p>
        )}

        {organizationId && (
          <form onSubmit={submit} className="space-y-3 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900">{editingId ? "Edit client" : "Add a client"}</h3>
            <Input label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Email" type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} maxLength={254} />
              <Input label="Phone" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} maxLength={40} />
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Notes
              <textarea className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !form.name.trim()}>{editingId ? "Save client" : "Add client"}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Cancel</Button>}
            </div>
          </form>
        )}

        {message && (
          <p role={message.type === "error" ? "alert" : "status"} className={message.type === "error" ? "text-sm text-red-700" : "text-sm text-green-700"}>{message.text}</p>
        )}
      </CardContent>
    </Card>
  );
}

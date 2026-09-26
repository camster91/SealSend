"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Organization = { id: string; name: string; is_personal: boolean; role: string };
type Webhook = {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  active: boolean;
  secret_preview: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
};
type Delivery = { id: string; webhook_id: string; event_type: string; status: string; attempts: number; last_status_code: number | null; last_error: string | null; created_at: string };
type WebhooksResponse = { webhooks: Webhook[]; deliveries: Delivery[]; available: boolean; eventTypes: string[]; limit: number };

const EVENT_LABELS: Record<string, string> = {
  "rsvp.submitted": "RSVP submitted",
  "guest.checked_in": "Guest checked in",
  "event.published": "Event published",
  "client.approved": "Client approved",
};

export function WebhookSettings() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [data, setData] = useState<WebhooksResponse | null>(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["rsvp.submitted"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/organizations")
      .then((res) => (res.ok ? res.json() : { organizations: [] }))
      .then((body: { organizations: Organization[] }) => {
        const manageable = body.organizations.filter((organization) => organization.role === "owner" || organization.role === "admin");
        setOrganizations(manageable);
        setOrganizationId(manageable.find((organization) => !organization.is_personal)?.id ?? manageable[0]?.id ?? null);
      });
  }, []);

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/organizations/${id}/webhooks`);
    setData(res.ok ? await res.json() : null);
  }, []);

  useEffect(() => { if (organizationId) void load(organizationId); }, [organizationId, load]);

  async function run(action: () => Promise<Response>, success: (body: Record<string, unknown>) => string) {
    if (!organizationId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await action();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: body.error || "Something went wrong. Please try again." });
        return;
      }
      setMessage({ type: "success", text: success(body) });
      await load(organizationId);
    } finally {
      setBusy(false);
    }
  }

  const json = (method: string, payload?: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Webhooks</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-gray-600">
          SealSend sends a signed JSON POST to your URL when something happens on this workspace&apos;s events. Use it with Zapier or Make (&quot;Catch Hook&quot;), or your own server. Failed deliveries are retried for about 15 hours.
        </p>

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

        {!organizationId && <p className="text-sm text-gray-500">Only workspace owners and admins can manage webhooks.</p>}

        {data && !data.available && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Webhooks are available on organizer plans. Existing endpoints stay listed but don&apos;t receive events.</p>
        )}

        {newSecret && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <p className="font-medium text-gray-800">Signing secret: copy it now. It won&apos;t be shown again.</p>
            <div className="mt-1 flex gap-2">
              <input readOnly aria-label="Webhook signing secret" value={newSecret} className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
              <button type="button" className="rounded border border-gray-300 px-2 text-xs" onClick={() => void navigator.clipboard?.writeText(newSecret)}>Copy</button>
            </div>
            <p className="mt-2 text-gray-600">Verify each request&apos;s <code>SealSend-Signature</code> header with it. See <a className="text-brand-700 hover:underline" href="https://github.com/camster91/SealSend/blob/master/docs/webhooks.md">the webhook docs</a>.</p>
          </div>
        )}

        {data && data.webhooks.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
            {data.webhooks.map((webhook) => (
              <li key={webhook.id} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-xs text-gray-900">{webhook.url}</p>
                  <span className={webhook.active ? "text-green-700" : "text-gray-500"}>{webhook.active ? "Active" : "Paused"}</span>
                </div>
                <p className="text-gray-600">
                  {webhook.events.map((type) => EVENT_LABELS[type] ?? type).join(", ")} · secret {webhook.secret_preview}
                  {webhook.consecutive_failures > 0 && <span className="text-red-700"> · {webhook.consecutive_failures} failed in a row</span>}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void run(
                    () => fetch(`/api/organizations/${organizationId}/webhooks/${webhook.id}/test`, json("POST")),
                    (body) => body.ok ? `Test event delivered (HTTP ${body.statusCode}).` : `Test failed: ${body.error ?? "no response"}.`,
                  )}>Send test</Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void run(
                    () => fetch(`/api/organizations/${organizationId}/webhooks/${webhook.id}`, json("PATCH", { active: !webhook.active })),
                    () => webhook.active ? "Webhook paused." : "Webhook resumed.",
                  )}>{webhook.active ? "Pause" : "Resume"}</Button>
                  <Button type="button" variant="ghost" disabled={busy} aria-label={`Delete webhook ${webhook.url}`} onClick={() => void run(
                    () => fetch(`/api/organizations/${organizationId}/webhooks/${webhook.id}`, json("DELETE")),
                    () => "Webhook deleted.",
                  )}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {data && data.available && data.webhooks.length < data.limit && (
          <form
            className="space-y-3 rounded-lg border border-gray-200 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () => fetch(`/api/organizations/${organizationId}/webhooks`, json("POST", { url, events })),
                (body) => {
                  setNewSecret(typeof body.secret === "string" ? body.secret : null);
                  setUrl("");
                  return "Webhook added.";
                },
              );
            }}
          >
            <h3 className="text-sm font-semibold text-gray-900">Add an endpoint</h3>
            <Input label="Endpoint URL" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://hooks.zapier.com/…" required maxLength={500} />
            <fieldset className="space-y-1 text-sm">
              <legend className="font-medium text-gray-700">Events</legend>
              {data.eventTypes.map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={events.includes(type)}
                    onChange={(event) => setEvents((current) => event.target.checked ? [...current, type] : current.filter((value) => value !== type))}
                  />
                  {EVENT_LABELS[type] ?? type} <code className="text-xs text-gray-500">{type}</code>
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={busy || !url || events.length === 0}>Add webhook</Button>
          </form>
        )}

        {data && data.deliveries.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Recent deliveries</h3>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-xs">
              {data.deliveries.map((delivery) => (
                <li key={delivery.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                  <span>{EVENT_LABELS[delivery.event_type] ?? delivery.event_type} · {new Date(delivery.created_at).toLocaleString()}</span>
                  <span className={delivery.status === "delivered" ? "text-green-700" : delivery.status === "failed" ? "text-red-700" : "text-gray-600"}>
                    {delivery.status}{delivery.last_status_code ? ` (HTTP ${delivery.last_status_code})` : ""}{delivery.status !== "delivered" && delivery.last_error ? ` · ${delivery.last_error}` : ""} · {delivery.attempts} attempt{delivery.attempts === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {message && (
          <p role={message.type === "error" ? "alert" : "status"} className={message.type === "error" ? "text-sm text-red-700" : "text-sm text-green-700"}>{message.text}</p>
        )}
      </CardContent>
    </Card>
  );
}

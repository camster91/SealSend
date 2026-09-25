"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ALLOWED_FONTS } from "@/lib/sanitize";

type Organization = { id: string; name: string; plan: string; is_personal: boolean; role: string };
type Brand = {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  background_color: string | null;
  font_family: string | null;
  sender_name: string | null;
  reply_to_email: string | null;
  sms_signature: string | null;
  white_label: boolean;
};

const EMPTY_FORM = {
  name: "",
  logoUrl: "",
  primaryColor: "",
  backgroundColor: "",
  fontFamily: "",
  senderName: "",
  replyToEmail: "",
  smsSignature: "",
  whiteLabel: false,
};

function toForm(brand: Brand | null) {
  if (!brand) return EMPTY_FORM;
  return {
    name: brand.name,
    logoUrl: brand.logo_url ?? "",
    primaryColor: brand.primary_color ?? "",
    backgroundColor: brand.background_color ?? "",
    fontFamily: brand.font_family ?? "",
    senderName: brand.sender_name ?? "",
    replyToEmail: brand.reply_to_email ?? "",
    smsSignature: brand.sms_signature ?? "",
    whiteLabel: brand.white_label,
  };
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function BrandSettings() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [hasBrand, setHasBrand] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [whiteLabelAvailable, setWhiteLabelAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/organizations")
      .then((res) => (res.ok ? res.json() : { organizations: [] }))
      .then((data: { organizations: Organization[] }) => {
        setOrganizations(data.organizations);
        setOrganizationId(data.organizations[0]?.id ?? null);
        if (data.organizations.length === 0) setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    setMessage(null);
    fetch(`/api/organizations/${organizationId}/brand`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { brand: Brand | null; canEdit: boolean; whiteLabelAvailable: boolean } | null) => {
        setForm(toForm(data?.brand ?? null));
        setHasBrand(Boolean(data?.brand));
        setCanEdit(Boolean(data?.canEdit));
        setWhiteLabelAvailable(Boolean(data?.whiteLabelAvailable));
      })
      .finally(() => setLoading(false));
  }, [organizationId]);

  const update = (key: keyof typeof EMPTY_FORM) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.type === "checkbox" ? (event.target as HTMLInputElement).checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    for (const [label, value] of [["Primary colour", form.primaryColor], ["Background colour", form.backgroundColor]] as const) {
      if (value && !HEX.test(value)) {
        setMessage({ type: "error", text: `${label} must be a 6-digit hex colour like #7c3aed.` });
        return;
      }
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/brand`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          logoUrl: form.logoUrl || null,
          primaryColor: form.primaryColor || null,
          backgroundColor: form.backgroundColor || null,
          fontFamily: form.fontFamily || null,
          senderName: form.senderName,
          replyToEmail: form.replyToEmail,
          smsSignature: form.smsSignature,
          whiteLabel: form.whiteLabel,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Could not save the brand." });
        return;
      }
      setForm(toForm(data.brand));
      setHasBrand(true);
      setMessage({ type: "success", text: "Brand saved. It now applies to this workspace's event pages, emails and texts." });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!organizationId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/brand`, { method: "DELETE" });
      if (res.ok) {
        setForm(EMPTY_FORM);
        setHasBrand(false);
        setMessage({ type: "success", text: "Brand removed. Events use SealSend's default look again." });
      }
    } finally {
      setSaving(false);
    }
  }

  const displayName = form.senderName || form.name || "Your brand";
  const whiteLabelActive = form.whiteLabel && whiteLabelAvailable;
  const smsPreview = `- ${form.smsSignature || form.name || "Your brand"}${whiteLabelActive ? "" : " via Seal and Send"}`;
  const fromPreview = whiteLabelActive ? displayName : `${displayName} via SealSend`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand kit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-gray-600">
          Your brand is applied to every event in the workspace: event page colours, font and logo (unless an event sets its own), the email footer and sender name, and the signature on text messages.
        </p>

        {organizations.length > 1 && (
          <label className="block text-sm font-medium text-gray-700">
            Workspace
            <select
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              value={organizationId ?? ""}
              onChange={(event) => setOrganizationId(event.target.value)}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </label>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !organizationId ? (
          <p className="text-sm text-gray-500">No workspace found.</p>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={!canEdit || saving} className="space-y-4">
              <Input label="Brand name" value={form.name} onChange={update("name")} required maxLength={80} />
              <Input label="Logo URL" value={form.logoUrl} onChange={update("logoUrl")} placeholder="https://…" maxLength={500} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Primary colour" value={form.primaryColor} onChange={update("primaryColor")} placeholder="#7c3aed" maxLength={7} />
                <Input label="Background colour" value={form.backgroundColor} onChange={update("backgroundColor")} placeholder="#ffffff" maxLength={7} />
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Font
                <select className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" value={form.fontFamily} onChange={update("fontFamily")}>
                  <option value="">Event default</option>
                  {ALLOWED_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Email sender name" value={form.senderName} onChange={update("senderName")} placeholder={form.name || "Brand name"} maxLength={60} />
                <Input label="Reply-to email" type="email" value={form.replyToEmail} onChange={update("replyToEmail")} placeholder="hello@yourbrand.com" maxLength={254} />
              </div>
              <Input label="Text message signature" value={form.smsSignature} onChange={update("smsSignature")} placeholder={form.name || "Brand name"} maxLength={40} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={form.whiteLabel} onChange={update("whiteLabel")} disabled={!whiteLabelAvailable} />
                <span>
                  Hide SealSend (white-label)
                  {!whiteLabelAvailable && <span className="block text-gray-500">Available on organizer plans.</span>}
                </span>
              </label>
            </fieldset>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p><span className="font-medium">Emails from:</span> {fromPreview}</p>
              <p><span className="font-medium">Texts end with:</span> {smsPreview}</p>
            </div>

            {message && (
              <p role={message.type === "error" ? "alert" : "status"} className={message.type === "error" ? "text-sm text-red-700" : "text-sm text-green-700"}>
                {message.text}
              </p>
            )}

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving || !form.name.trim()}>{saving ? "Saving…" : "Save brand"}</Button>
                {hasBrand && <Button type="button" variant="outline" onClick={remove} disabled={saving}>Remove brand</Button>}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Only workspace owners and admins can change the brand.</p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

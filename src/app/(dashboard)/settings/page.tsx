"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TIERS } from "@/lib/constants";
import { getClientUser } from "@/lib/auth/client-auth";
import { BetaParticipation } from "@/components/dashboard/BetaParticipation";

interface PaidEvent {
  id: string;
  title: string;
  tier: string;
  payment_id: string;
  updated_at: string;
}

interface DeletionRequest {
  status: "pending" | "cancelled" | "completed";
  requested_at: string;
  scheduled_for: string;
}

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [paidEvents, setPaidEvents] = useState<PaidEvent[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const userInfo = getClientUser();
    if (userInfo?.email) {
      setEmail(userInfo.email);
    }
    if (userInfo?.role) {
      setRole(userInfo.role);
    }

    fetch("/api/events?paid=true")
      .then((res) => (res.ok ? res.json() : []))
      .then((events: PaidEvent[]) => {
        setPaidEvents(events ?? []);
        setBillingLoading(false);
      })
      .catch(() => {
        setBillingLoading(false);
      });
    fetch("/api/account/deletion", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { request: null }))
      .then((data: { request: DeletionRequest | null }) => setDeletionRequest(data.request))
      .catch(() => setDeletionRequest(null));
  }, []);

  const updateDeletion = async (method: "POST" | "DELETE") => {
    setPrivacyLoading(true);
    setPrivacyMessage(null);
    try {
      const response = await fetch("/api/account/deletion", { method });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update deletion request");
      setDeletionRequest(data.request);
      setDeletionConfirmation("");
      setPrivacyMessage({
        type: "success",
        text: method === "POST" ? "Account deletion scheduled. You can cancel during the cooling-off period." : "Account deletion cancelled.",
      });
    } catch (error) {
      setPrivacyMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to update deletion request" });
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordMessage({
          type: "error",
          text: data.error || "Failed to change password",
        });
        return;
      }

      setPasswordMessage({ type: "success", text: "Password updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const getTierBadge = (tier: string) => {
    const styles: Record<string, string> = {
      gold: "bg-amber-100 text-amber-700",
      premium: "bg-amber-100 text-amber-700",
      platinum: "bg-slate-100 text-slate-700",
      diamond: "bg-indigo-100 text-indigo-700",
      silver: "bg-brand-100 text-brand-700",
      standard: "bg-brand-100 text-brand-700",
    };
    return styles[tier] || "bg-gray-100 text-gray-600";
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              id="account-email"
              label="Email"
              value={email}
              disabled
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand kit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>Put your logo, colours, sender name and text signature on every event page, email and text.</p>
            <Link href="/settings/brand" className="inline-flex font-medium text-brand-700 hover:underline">Edit brand kit →</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>Create a team workspace and invite planners and check-in staff to work on your events.</p>
            <Link href="/settings/team" className="inline-flex font-medium text-brand-700 hover:underline">Manage team →</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>Keep a record of who you run events for and send them read-only review links.</p>
            <Link href="/settings/clients" className="inline-flex font-medium text-brand-700 hover:underline">Manage clients →</Link>
          </CardContent>
        </Card>

        {role === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <Input
                  id="current-password"
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <Input
                  id="new-password"
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Input
                  id="confirm-new-password"
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {passwordMessage && (
                  <p
                    className={`text-sm ${
                      passwordMessage.type === "success"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {passwordMessage.text}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent>
            {billingLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : paidEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No paid upgrades yet. Upgrade an event to see billing history here.
              </p>
            ) : (
              <div className="space-y-3">
                {paidEvents.map((evt) => {
                  const tierInfo = TIERS[evt.tier as keyof typeof TIERS];
                  return (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {evt.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(evt.updated_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getTierBadge(evt.tier)}`}
                      >
                        {evt.tier.charAt(0).toUpperCase() + evt.tier.slice(1)} &middot; $
                        {tierInfo ? (tierInfo.price / 100).toFixed(2) : "0.00"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle>Privacy and account data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Download your data</p>
              <p className="mt-1 text-sm text-muted-foreground">Export your account, events, guests, responses, comments, and signup claims as JSON.</p>
              <a
                href="/api/account/export"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Download account export
              </a>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-red-700">Delete account</p>
              {deletionRequest?.status === "pending" ? (
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-gray-700">
                    Deletion is scheduled for {new Date(deletionRequest.scheduled_for).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}. Your owned events and related guest data will be permanently removed.
                  </p>
                  <button type="button" disabled={privacyLoading} onClick={() => updateDeletion("DELETE")} className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
                    Cancel deletion
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-gray-700">Deletion has a seven-day cooling-off period. Active subscriptions must be cancelled first. Download an export before continuing.</p>
                  <Input id="account-deletion-confirmation" label={'Type "DELETE" to confirm'} value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} autoComplete="off" />
                  <button type="button" disabled={privacyLoading || deletionConfirmation !== "DELETE"} onClick={() => updateDeletion("POST")} className="min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                    Schedule account deletion
                  </button>
                </div>
              )}
              {privacyMessage && <p role={privacyMessage.type === "error" ? "alert" : "status"} className={`mt-3 text-sm ${privacyMessage.type === "error" ? "text-red-700" : "text-green-700"}`}>{privacyMessage.text}</p>}
            </div>
          </CardContent>
        </Card>

        {role === "admin" && <BetaParticipation />}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TIERS } from "@/lib/constants";
import { getClientUser } from "@/lib/auth/client-auth";

interface PaidEvent {
  id: string;
  title: string;
  tier: string;
  payment_id: string;
  updated_at: string;
}

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [paidEvents, setPaidEvents] = useState<PaidEvent[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);

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
  }, []);

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
              label="Email"
              value={email}
              disabled
            />
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
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Input
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
      </div>
    </div>
  );
}

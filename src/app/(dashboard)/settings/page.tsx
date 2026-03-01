"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TIERS } from "@/lib/constants";

interface PaidEvent {
  id: string;
  title: string;
  tier: string;
  payment_id: string;
  updated_at: string;
}

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paidEvents, setPaidEvents] = useState<PaidEvent[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");

      if (data.user) {
        supabase
          .from("events")
          .select("id, title, tier, payment_id, updated_at")
          .eq("user_id", data.user.id)
          .not("payment_id", "is", null)
          .order("updated_at", { ascending: false })
          .then(({ data: events }) => {
            setPaidEvents(events ?? []);
            setBillingLoading(false);
          });
      } else {
        setBillingLoading(false);
      }
    });
  }, []);

  async function handlePasswordUpdate() {
    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated successfully");
      setNewPassword("");
    }
    setLoading(false);
  }

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

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="New Password"
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}
            <Button onClick={handlePasswordUpdate} loading={loading}>
              Update Password
            </Button>
          </CardContent>
        </Card>

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
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          evt.tier === "premium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-brand-100 text-brand-700"
                        }`}
                      >
                        {evt.tier.charAt(0).toUpperCase() + evt.tier.slice(1)} &middot; ${tierInfo?.price ?? "0"}
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

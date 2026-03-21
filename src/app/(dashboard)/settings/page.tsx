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
  const [paidEvents, setPaidEvents] = useState<PaidEvent[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);

  useEffect(() => {
    const userInfo = getClientUser();
    if (userInfo?.email) {
      setEmail(userInfo.email);
    }

    // Fetch paid events via API
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

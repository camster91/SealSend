"use client";

import { useEffect, useState } from "react";
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
  const [message, setMessage] = useState<string | null>(null);
  const [paidEvents, setPaidEvents] = useState<PaidEvent[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          setBillingLoading(false);
          return;
        }
        const data = await res.json();
        const user = data.user;
        if (user) {
          setEmail(user.email ?? "");
        }
      } catch {
        // Not signed in
      }
      setBillingLoading(false);
    }
    loadUser();
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
            ) : (
              <p className="text-sm text-muted-foreground">
                Billing information is available through event management.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

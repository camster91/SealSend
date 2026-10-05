"use client";

import { useEffect, useState } from "react";
import { getClientUser } from "@/lib/auth/client-auth";
import { getInitials } from "@/lib/utils";
import { Logo } from "@/components/layout/Logo";

export function DashboardHeader() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const user = getClientUser();
    setEmail(user?.email ?? null);
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 sm:h-16 sm:px-6">
      {/* Mobile logo */}
      <Logo href="/dashboard" className="md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2" />
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        {email && (
          <>
            <span className="hidden text-sm text-neutral-600 sm:block">{email}</span>
            <div aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-primary-50 text-xs font-semibold text-ink">
              {getInitials(email.split("@")[0])}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

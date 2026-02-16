"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import Link from "next/link";

export function DashboardHeader() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 sm:h-16 sm:px-6">
      {/* Mobile logo */}
      <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
        <span className="text-lg font-bold">
          <span className="text-foreground">Seal</span>
          <span className="text-brand-600">Send</span>
        </span>
      </Link>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        {email && (
          <>
            <span className="hidden text-sm text-muted-foreground sm:block">{email}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {getInitials(email.split("@")[0])}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

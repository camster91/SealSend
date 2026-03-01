"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarPlus,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events/new", label: "Create Event", icon: CalendarPlus },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-white">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">
            <span className="text-foreground">Seal</span>
            <span className="text-brand-600">Send</span>
          </span>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
            Beta
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted-foreground hover:bg-neutral-50 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-neutral-50 hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

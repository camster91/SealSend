"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Menu, X, ChevronDown, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

const useCaseLinks = [
  { label: "Weddings", href: "/use-cases/weddings" },
  { label: "Baby Showers", href: "/use-cases/baby-showers" },
  { label: "Birthday Parties", href: "/use-cases/birthday-parties" },
  { label: "Corporate Events", href: "/use-cases/corporate-events" },
];

export function Navbar({ user }: { user?: User | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="gradient-top-bar h-1" />
      <nav className="border-b border-border bg-white sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">
              <span className="text-foreground">Seal</span>
              <span className="text-brand-600">Send</span>
            </span>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
              Beta
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </Link>

            {/* Use Cases dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                Use Cases
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    dropdownOpen && "rotate-180"
                  )}
                />
              </button>
              {dropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-white py-1 shadow-lg animate-in fade-in slide-in-from-top-2">
                  {useCaseLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-2 text-sm text-muted-foreground hover:bg-neutral-50 hover:text-foreground transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>

            {user ? (
              <Link href="/dashboard">
                <Button size="sm" className="gap-2 shadow-sm transition-all hover:-translate-y-0.5">
                  <UserIcon className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-4 ml-2 border-l border-border pl-6">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="transition-colors">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="shadow-sm transition-all hover:-translate-y-0.5">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-4 md:hidden">
            {user && (
              <Link href="/dashboard" className="text-sm font-medium text-brand-600">
                Dashboard
              </Link>
            )}
            <button
              className="rounded-lg p-2 hover:bg-neutral-100 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 md:hidden bg-white/95 backdrop-blur-sm",
            mobileOpen ? "max-h-96 border-b border-border shadow-md" : "max-h-0"
          )}
        >
          <div className="space-y-2 px-4 pb-4">
            <Link
              href="/how-it-works"
              className="block rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-neutral-50"
              onClick={() => setMobileOpen(false)}
            >
              How It Works
            </Link>

            <div className="px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Use Cases
              </p>
              <div className="mt-1 space-y-1">
                {useCaseLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-neutral-50 hover:text-foreground"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <Link
              href="/pricing"
              className="block rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-neutral-50"
              onClick={() => setMobileOpen(false)}
            >
              Pricing
            </Link>

            {!user && (
              <div className="flex gap-2 pt-4 border-t border-border mt-2">
                <Link href="/login" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup" className="flex-1">
                  <Button size="sm" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

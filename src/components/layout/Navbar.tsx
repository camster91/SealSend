"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarUser {
  id: string;
  email?: string | null;
  role?: 'admin' | 'guest';
  eventId?: string;
}

const useCaseLinks = [
  { label: "Community Events", href: "/use-cases/community-events" },
  { label: "Local Nonprofits", href: "/use-cases/nonprofit-events" },
  { label: "Clubs & Associations", href: "/use-cases/clubs-associations" },
  { label: "Professional Gatherings", href: "/use-cases/professional-gatherings" },
];

export function Navbar({ user }: { user?: NavbarUser | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

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

  // Close mobile nav on Escape and restore focus to the toggle. Listener is
  // only attached while the drawer is open, so no global handler leaks.
  useEffect(() => {
    if (!mobileOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        mobileToggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

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
                aria-expanded={dropdownOpen}
                aria-controls="desktop-use-cases-menu"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setDropdownOpen(false);
                }}
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
                <div id="desktop-use-cases-menu" className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-white py-1 shadow-lg animate-in fade-in slide-in-from-top-2">
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
              <Link href="/dashboard" className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-brand-600 px-3 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <UserIcon className="h-4 w-4" />
                  Dashboard
              </Link>
            ) : (
              <div className="flex items-center gap-4 ml-2 border-l border-border pl-6">
                <Link href="/login" className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Sign in
                </Link>
                <Link href="/signup" className="inline-flex h-8 items-center justify-center rounded-md bg-brand-600 px-3 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Get Started
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
              ref={mobileToggleRef}
              aria-label="Toggle mobile navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
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
        {mobileOpen && <div id="mobile-navigation" className="border-b border-border bg-white/95 shadow-md backdrop-blur-sm md:hidden">
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
                <Link href="/login" className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Sign in
                </Link>
                <Link href="/signup" className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Get Started
                </Link>
              </div>
            )}
          </div>
        </div>}
      </nav>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/Logo";
import { PRIMARY_CTA_LABEL } from "@/components/marketing/Cta";

interface NavbarUser {
  id: string;
  email?: string | null;
  role?: 'admin' | 'guest';
  eventId?: string;
}

const useCaseLinks = [
  { label: "Event planners", href: "/use-cases/event-planners" },
  { label: "Weddings", href: "/use-cases/weddings" },
  { label: "Birthday parties", href: "/use-cases/birthday-parties" },
  { label: "Community events", href: "/use-cases/community-events" },
  { label: "Clubs and associations", href: "/use-cases/clubs-associations" },
  { label: "Local nonprofits", href: "/use-cases/nonprofit-events" },
  { label: "Professional gatherings", href: "/use-cases/professional-gatherings" },
];

const navLink =
  "inline-flex min-h-11 items-center rounded-lg px-3 text-[0.95rem] font-medium text-neutral-700 transition-colors hover:text-ink";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-4 text-[0.95rem] font-semibold text-white transition-colors hover:bg-wax focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

export function Navbar({ user }: { user?: NavbarUser | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

  // Server HTML keeps the navigation visible while the client hydrates, but
  // clicks cannot be handled until React has attached the listeners. Keep
  // controls out of the tab order for that short window so a fast keyboard
  // user never loses an activation.
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Close both menus whenever the route changes (including back/forward), so an open
  // drawer never carries over and covers the next page.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
    setDropdownOpen(false);
  }

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
    // A tap outside the nav, or widening to the desktop layout, also closes the drawer.
    function handlePointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    const desktop = window.matchMedia("(min-width: 1024px)");
    function handleBreakpoint(e: MediaQueryListEvent) {
      if (e.matches) setMobileOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("pointerdown", handlePointerDown);
    desktop.addEventListener("change", handleBreakpoint);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("pointerdown", handlePointerDown);
      desktop.removeEventListener("change", handleBreakpoint);
    };
  }, [mobileOpen]);

  return (
    <nav ref={navRef} aria-label="Main" className="sticky top-0 z-50 border-b border-border bg-cotton/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 lg:flex">
          <Link href="/how-it-works" className={navLink}>
            How it works
          </Link>

          {/* Use cases dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              disabled={!hydrated}
              aria-expanded={dropdownOpen}
              aria-controls="desktop-use-cases-menu"
              className={cn(navLink, "gap-1")}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setDropdownOpen(false);
              }}
            >
              Use cases
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 transition-transform",
                  dropdownOpen && "rotate-180"
                )}
              />
            </button>
            {dropdownOpen && (
              <div id="desktop-use-cases-menu" className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-white p-1.5 shadow-lg">
                <Link
                  href="/use-cases"
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink hover:bg-cotton"
                  onClick={() => setDropdownOpen(false)}
                >
                  All use cases
                </Link>
                {useCaseLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex min-h-11 items-center rounded-lg px-3 text-sm text-neutral-700 hover:bg-cotton hover:text-ink"
                    onClick={() => setDropdownOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/pricing" className={navLink}>
            Pricing
          </Link>

          <div className="ml-4 flex items-center gap-2 border-l border-border pl-5">
            {user ? (
              <Link href="/dashboard" className={primaryButton}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className={navLink}>
                  Log in
                </Link>
                <Link href="/signup" className={primaryButton}>
                  {PRIMARY_CTA_LABEL}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 lg:hidden">
          {user && (
            <Link href="/dashboard" className={navLink}>
              Dashboard
            </Link>
          )}
          <button
            ref={mobileToggleRef}
            type="button"
            disabled={!hydrated}
            aria-label="Toggle mobile navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && <div id="mobile-navigation" className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-border bg-cotton lg:hidden">
        <div className="space-y-1 px-4 pb-6 pt-3">
          <Link
            href="/how-it-works"
            className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-ink hover:bg-white"
            onClick={() => setMobileOpen(false)}
          >
            How it works
          </Link>

          <div className="px-3 pt-3">
            <p className="text-sm font-medium text-neutral-600">Use cases</p>
            <div className="mt-1">
              {useCaseLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center rounded-lg px-2 text-base text-neutral-700 hover:bg-white hover:text-ink"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/pricing"
            className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-ink hover:bg-white"
            onClick={() => setMobileOpen(false)}
          >
            Pricing
          </Link>

          {!user && (
            <div className="mt-3 flex gap-2 border-t border-border pt-4">
              <Link href="/login" className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border border-ink/20 bg-white text-base font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
                Log in
              </Link>
              <Link href="/signup" className={cn(primaryButton, "h-12 flex-1 text-base")}>
                {PRIMARY_CTA_LABEL}
              </Link>
            </div>
          )}
        </div>
      </div>}
    </nav>
  );
}

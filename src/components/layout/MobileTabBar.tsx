'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, CalendarPlus, Settings } from 'lucide-react';

const tabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/events/new', label: 'Create', icon: CalendarPlus },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/95 backdrop-blur-lg safe-area-bottom md:hidden">
      <div className="flex items-stretch justify-around px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.href ||
            (tab.href !== '/dashboard' && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink',
                isActive
                  ? 'text-ink font-semibold'
                  : 'text-neutral-600 active:text-ink'
              )}
            >
              {/* The active tab gets a filled Ink-tinted pill behind its icon, so the state does not rely on colour alone. */}
              <span
                className={cn(
                  'flex h-7 w-14 items-center justify-center rounded-full transition-colors',
                  isActive ? 'bg-primary-100' : 'group-active:bg-neutral-100'
                )}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2.25 : 1.75}
                  aria-hidden
                />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

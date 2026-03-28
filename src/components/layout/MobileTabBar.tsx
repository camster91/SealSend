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
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-lg safe-area-bottom md:hidden">
      <div className="flex items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.href ||
            (tab.href !== '/dashboard' && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 pt-3 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-brand-600'
                  : 'text-gray-400 active:text-gray-600'
              )}
            >
              <Icon
                className={cn(
                  'h-6 w-6 transition-transform',
                  isActive && 'scale-110'
                )}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

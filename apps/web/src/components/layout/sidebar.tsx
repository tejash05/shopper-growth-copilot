'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LayoutDashboard, Megaphone, Sparkles, Upload, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspaceSelector } from '@/components/layout/workspace-selector';
import { ReplayTourButton } from '@/components/onboarding/replay-tour-button';

const NAV = [
  { href: '/', label: 'Command Center', icon: LayoutDashboard, tourId: 'sidebar-command-center' },
  { href: '/customers', label: 'Shoppers', icon: Users, tourId: 'sidebar-shoppers' },
  { href: '/segments', label: 'Segments', icon: BarChart3, tourId: 'sidebar-segments' },
  { href: '/campaigns/studio', label: 'Campaign Studio', icon: Sparkles, tourId: 'sidebar-campaign-studio' },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, tourId: 'sidebar-campaigns' },
  { href: '/data-import', label: 'Data Import', icon: Upload, tourId: 'sidebar-data-import' },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Shopper Growth</p>
          <p className="text-xs text-muted-foreground">Copilot</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tourId}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div data-tour="workspace-selector">
          <WorkspaceSelector />
        </div>
        <ReplayTourButton />
      </div>
    </aside>
  );
}

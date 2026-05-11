'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, CheckSquare, CreditCard,
  Megaphone, BarChart2, Users, Settings, Zap, Network, Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/contracts', label: 'Contracts', icon: FileText, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/deliverables', label: 'Deliverables', icon: CheckSquare, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/creators', label: 'Creators', icon: Users, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/graph', label: 'Creator Graph', icon: Network, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/insights', label: 'AI Insights', icon: Brain, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role ?? 'BRAND';

  const filtered = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card px-3 py-4">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold">Conic</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {filtered.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

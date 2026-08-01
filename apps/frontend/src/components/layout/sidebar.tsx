'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, CheckSquare, CreditCard,
  Megaphone, BarChart2, Users, Settings, Zap, Network, Brain,
  ShieldCheck, GraduationCap, UserCircle, Store, Key, Upload,
  ClipboardList, TrendingUp, Heart, DollarSign,
  Sparkles, CalendarDays, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  // ─── Brand / Creator / Agency / Admin ────────────────────────────────────
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/profile', label: 'My Profile', icon: UserCircle, roles: ['CREATOR', 'ATHLETE'] },
  { href: '/dashboard/contracts', label: 'Contracts', icon: FileText, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/deliverables', label: 'Deliverables', icon: CheckSquare, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/creators', label: 'Creators', icon: Users, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/graph', label: 'Creator Graph', icon: Network, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/insights', label: 'AI Insights', icon: Brain, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/contract-templates', label: 'Templates', icon: ClipboardList, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/marketplace', label: 'NIL Marketplace', icon: Store, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/match', label: 'AI Matchmaking', icon: Sparkles, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/earnings', label: 'Earnings', icon: DollarSign, roles: ['BRAND', 'CREATOR', 'ATHLETE', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays, roles: ['BRAND', 'CREATOR', 'ATHLETE', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/collectives', label: 'Collectives', icon: Building2, roles: ['ADMIN', 'COLLECTIVE_ADMIN', 'UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: Key, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/dashboard/importers', label: 'Data Import', icon: Upload, roles: ['AGENCY', 'ADMIN', 'UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },

  // ─── Athlete ──────────────────────────────────────────────────────────────
  { href: '/athlete', label: 'NIL Hub', icon: TrendingUp, roles: ['ATHLETE'] },
  { href: '/athlete/marketplace', label: 'My Listing', icon: Store, roles: ['ATHLETE'] },
  { href: '/athlete/contracts', label: 'My Contracts', icon: FileText, roles: ['ATHLETE'] },
  { href: '/athlete/payments', label: 'Earnings', icon: CreditCard, roles: ['ATHLETE'] },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays, roles: ['ATHLETE'] },

  // ─── Guardian ─────────────────────────────────────────────────────────────
  { href: '/guardian', label: 'Guardian Portal', icon: Heart, roles: ['GUARDIAN'] },

  // ─── Agent ────────────────────────────────────────────────────────────────
  { href: '/agents/me', label: 'Agent Profile', icon: UserCircle, roles: ['AGENT'] },
  { href: '/dashboard/marketplace', label: 'NIL Marketplace', icon: Store, roles: ['AGENT'] },
  { href: '/agents/contracts', label: 'Client Contracts', icon: FileText, roles: ['AGENT'] },

  // ─── Compliance Officer ───────────────────────────────────────────────────
  { href: '/nil-compliance', label: 'NIL Compliance', icon: ShieldCheck, roles: ['COMPLIANCE_OFFICER'] },
  { href: '/school-reporting', label: 'School Reports', icon: GraduationCap, roles: ['COMPLIANCE_OFFICER'] },

  // ─── University Admin / Athletic Director ─────────────────────────────────
  { href: '/school-reporting', label: 'Reporting', icon: GraduationCap, roles: ['UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },
  { href: '/nil-compliance', label: 'Compliance', icon: ShieldCheck, roles: ['UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },
  { href: '/dashboard/importers', label: 'Data Import', icon: Upload, roles: ['UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role ?? 'BRAND';

  const filtered = navItems.filter((item) => item.roles.includes(role));
  // Deduplicate by href so shared routes (e.g., /dashboard/importers) appear once
  const seen = new Set<string>();
  const deduped = filtered.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card px-3 py-4">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold">Conic</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {deduped.map((item) => {
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

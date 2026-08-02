'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, CheckSquare, CreditCard,
  Megaphone, BarChart2, Users, Settings, Zap, Network, Brain,
  ShieldCheck, ShieldAlert, GraduationCap, UserCircle, Store, Key, Upload, BadgeCheck, Bookmark,
  ClipboardList, TrendingUp, Heart, DollarSign,
  Sparkles, CalendarDays, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  // ─── Brand / Creator / Agency / Admin ────────────────────────────────────
  { href: '/overview', label: 'Dashboard', icon: LayoutDashboard, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/profile', label: 'My Profile', icon: UserCircle, roles: ['CREATOR', 'ATHLETE'] },
  { href: '/verification', label: 'Verification', icon: BadgeCheck, roles: ['CREATOR', 'ATHLETE', 'BRAND'] },
  { href: '/opportunities', label: 'Opportunities', icon: Megaphone, roles: ['CREATOR', 'ATHLETE'] },
  { href: '/briefs', label: 'Open Briefs', icon: Megaphone, roles: ['BRAND', 'AGENCY'] },
  { href: '/billing', label: 'Billing & Plans', icon: CreditCard, roles: ['BRAND', 'AGENCY'] },
  { href: '/contracts', label: 'Contracts', icon: FileText, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/deliverables', label: 'Deliverables', icon: CheckSquare, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/payments', label: 'Payments', icon: CreditCard, roles: ['BRAND', 'CREATOR', 'AGENCY', 'ADMIN'] },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/analytics', label: 'Analytics', icon: BarChart2, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/creators', label: 'Creators', icon: Users, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/saved', label: 'Saved Profiles', icon: Bookmark, roles: ['BRAND', 'AGENCY'] },
  { href: '/graph', label: 'Creator Graph', icon: Network, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/insights', label: 'AI Insights', icon: Brain, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/contract-templates', label: 'Templates', icon: ClipboardList, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/marketplace', label: 'NIL Marketplace', icon: Store, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/match', label: 'AI Matchmaking', icon: Sparkles, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/earnings', label: 'Earnings', icon: DollarSign, roles: ['BRAND', 'CREATOR', 'ATHLETE', 'AGENCY', 'ADMIN'] },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['BRAND', 'CREATOR', 'ATHLETE', 'AGENCY', 'ADMIN'] },
  { href: '/collectives', label: 'Collectives', icon: Building2, roles: ['ADMIN', 'COLLECTIVE_ADMIN', 'UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },
  { href: '/api-keys', label: 'API Keys', icon: Key, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/circumvention', label: 'Platform Integrity', icon: ShieldAlert, roles: ['BRAND', 'AGENCY', 'ADMIN'] },
  { href: '/importers', label: 'Data Import', icon: Upload, roles: ['AGENCY', 'ADMIN', 'UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },

  // ─── Athlete ──────────────────────────────────────────────────────────────
  { href: '/athlete', label: 'NIL Hub', icon: TrendingUp, roles: ['ATHLETE'] },
  { href: '/athlete/marketplace', label: 'My Listing', icon: Store, roles: ['ATHLETE'] },
  { href: '/athlete/contracts', label: 'My Contracts', icon: FileText, roles: ['ATHLETE'] },
  { href: '/athlete/payments', label: 'Earnings', icon: CreditCard, roles: ['ATHLETE'] },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['ATHLETE'] },

  // ─── Guardian ─────────────────────────────────────────────────────────────
  { href: '/guardian', label: 'Guardian Portal', icon: Heart, roles: ['GUARDIAN'] },

  // ─── Agent ────────────────────────────────────────────────────────────────
  { href: '/agents/me', label: 'Agent Profile', icon: UserCircle, roles: ['AGENT'] },
  { href: '/marketplace', label: 'NIL Marketplace', icon: Store, roles: ['AGENT'] },
  { href: '/agents/contracts', label: 'Client Contracts', icon: FileText, roles: ['AGENT'] },

  // ─── Compliance Officer ───────────────────────────────────────────────────
  { href: '/school', label: 'Compliance Center', icon: GraduationCap, roles: ['COMPLIANCE_OFFICER', 'UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR', 'ADMIN'] },
  { href: '/nil-compliance', label: 'NIL Compliance', icon: ShieldCheck, roles: ['COMPLIANCE_OFFICER'] },
  { href: '/school-reporting', label: 'School Reports', icon: GraduationCap, roles: ['COMPLIANCE_OFFICER'] },

  // ─── University Admin / Athletic Director ─────────────────────────────────
  { href: '/school-reporting', label: 'Reporting', icon: GraduationCap, roles: ['UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },
  { href: '/nil-compliance', label: 'Compliance', icon: ShieldCheck, roles: ['UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },
  { href: '/importers', label: 'Data Import', icon: Upload, roles: ['UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR'] },
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
    <aside className="glass sheen z-10 flex h-full w-64 flex-col rounded-none border-y-0 border-l-0 px-3 py-4">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="accent-grad flex h-9 w-9 items-center justify-center rounded-xl shadow-[0_0_22px_-4px_rgba(56,200,255,0.8)]">
          <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="chrome-text font-display text-xl font-bold tracking-tight">Conic</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
        {deduped.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-white/[0.07] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
                  : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
              )}
            >
              {active && (
                <span className="accent-grad absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full shadow-glow-sm" />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-primary text-glow' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/5 pt-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

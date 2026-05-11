'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, CheckSquare, CreditCard, Megaphone, TrendingUp, Users,
  AlertCircle, Clock, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface StatsCard { label: string; value: string; icon: React.ElementType; change?: string; }

function StatCard({ label, value, icon: Icon, change }: StatsCard) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && <p className="text-xs text-muted-foreground mt-1">{change}</p>}
      </CardContent>
    </Card>
  );
}

function ActionQueue() {
  const user = useAuthStore((s) => s.user);
  const { data: actions } = useQuery({
    queryKey: ['me', 'actions'],
    queryFn: () => api.get('/v1/auth/me/actions').then((r) => r.data),
    enabled: !!user,
  });

  if (!actions) return null;

  const isCreator = user?.role === 'CREATOR';
  const isBrand = user?.role === 'BRAND';

  const items: Array<{ icon: React.ElementType; label: string; count: number; href: string; urgency: 'high' | 'medium' | 'low' }> = [];

  if (isCreator) {
    if (actions.contractsToSign?.length) items.push({ icon: FileText, label: 'Contracts to sign', count: actions.contractsToSign.length, href: '/contracts', urgency: 'high' });
    if (actions.revisionRequests?.length) items.push({ icon: RefreshCw, label: 'Revision requests', count: actions.revisionRequests.length, href: '/deliverables', urgency: 'high' });
    if (actions.deliverablesOverdue?.length) items.push({ icon: Clock, label: 'Deliverables overdue', count: actions.deliverablesOverdue.length, href: '/deliverables', urgency: 'high' });
    if (actions.pendingPayments?.length) items.push({ icon: CreditCard, label: 'Pending payments', count: actions.pendingPayments.length, href: '/payments', urgency: 'medium' });
  }

  if (isBrand) {
    if (actions.pendingReview?.length) items.push({ icon: CheckSquare, label: 'Deliverables to review', count: actions.pendingReview.length, href: '/deliverables', urgency: 'high' });
    if (actions.contractsToSign?.length) items.push({ icon: FileText, label: 'Contracts to sign', count: actions.contractsToSign.length, href: '/contracts', urgency: 'high' });
    if (actions.disputedContracts?.length) items.push({ icon: AlertCircle, label: 'Open disputes', count: actions.disputedContracts.length, href: '/contracts', urgency: 'high' });
  }

  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-destructive" />
        Action Required
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <Link key={item.label} href={item.href}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-destructive/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs tabular-nums">
                    {item.count}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: analytics } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get('/v1/analytics/overview').then((r) => r.data.data),
  });

  const stats: StatsCard[] = [
    { label: 'Active Contracts', value: String(analytics?.activeContracts ?? '—'), icon: FileText, change: 'Contracts in effect' },
    { label: 'Pending Deliverables', value: String(analytics?.pendingDeliverables ?? '—'), icon: CheckSquare, change: 'Awaiting submission or review' },
    { label: 'Payments Released', value: analytics?.totalPaymentsReleased ? `$${(analytics.totalPaymentsReleased / 100).toFixed(0)}` : '—', icon: CreditCard, change: 'Total payout volume' },
    { label: 'Active Campaigns', value: String(analytics?.activeCampaigns ?? '—'), icon: Megaphone, change: 'Currently running' },
    { label: 'Avg Engagement', value: analytics?.avgEngagementRate ? `${analytics.avgEngagementRate.toFixed(1)}%` : '—', icon: TrendingUp, change: 'Across all campaigns' },
    { label: 'Creators', value: String(analytics?.totalCreators ?? '—'), icon: Users, change: 'In your network' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your creator partnerships</p>
      </div>
      <ActionQueue />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, CheckSquare, CreditCard, Megaphone, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your creator partnerships</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>
    </div>
  );
}

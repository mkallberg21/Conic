'use client';

import { useQuery } from '@tanstack/react-query';
import { DollarSign, Clock, TrendingUp, Calculator, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

function StatCard({ title, value, subtitle, icon: Icon, accent }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  accent?: 'green' | 'amber' | 'blue' | 'red';
}) {
  const accentClasses = {
    green: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50',
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${accentClasses[accent ?? 'blue']}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyChart({ months }: { months: Array<{ month: number; totalCents: number }> }) {
  const max = Math.max(...months.map((m) => m.totalCents), 1);
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <div className="flex items-end gap-1 h-32">
      {months.map((m, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-primary rounded-t transition-all"
            style={{ height: `${(m.totalCents / max) * 100}%`, minHeight: m.totalCents > 0 ? '4px' : '0' }}
          />
          <span className="text-[9px] text-muted-foreground">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export default function EarningsPage() {
  const currentYear = new Date().getFullYear();

  const { data: summary } = useQuery({
    queryKey: ['earnings', 'summary'],
    queryFn: () => api.get('/v1/earnings/summary').then((r) => r.data),
  });

  const { data: breakdown } = useQuery({
    queryKey: ['earnings', 'breakdown', currentYear],
    queryFn: () => api.get(`/v1/earnings/breakdown?year=${currentYear}`).then((r) => r.data),
  });

  const { data: pipeline } = useQuery({
    queryKey: ['earnings', 'pipeline'],
    queryFn: () => api.get('/v1/earnings/pipeline').then((r) => r.data),
  });

  const ytd = summary?.ytdEarningsCents ?? 0;
  const pending = summary?.pendingCents ?? 0;
  const pipelineTotal = summary?.pipelineCents ?? pipeline?.totalCents ?? 0;
  const tax = summary?.taxEstimateCents ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Earnings Intelligence</h1>
        <p className="text-muted-foreground">Your income overview, pipeline, and tax estimate</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="YTD Earnings"
          value={formatCurrency(ytd)}
          subtitle={`${currentYear} year-to-date`}
          icon={DollarSign}
          accent="green"
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(pending)}
          subtitle="Awaiting release"
          icon={Clock}
          accent="amber"
        />
        <StatCard
          title="Pipeline Value"
          value={formatCurrency(pipelineTotal)}
          subtitle="Active & upcoming deals"
          icon={TrendingUp}
          accent="blue"
        />
        <StatCard
          title="Tax Estimate"
          value={formatCurrency(tax)}
          subtitle={`${((summary?.taxRate ?? 0.153) * 100).toFixed(1)}% self-employment`}
          icon={Calculator}
          accent="red"
        />
      </div>

      {/* Monthly breakdown */}
      {breakdown?.monthly && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Breakdown — {currentYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyChart months={breakdown.monthly} />
          </CardContent>
        </Card>
      )}

      {/* Pipeline table */}
      {pipeline?.pipeline?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Active Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pipeline.pipeline.map((item: {
                contractId?: string; dealId?: string; title: string;
                totalValueCents: number; status: string; brand?: string; creator?: string;
              }) => (
                <div
                  key={item.contractId ?? item.dealId}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.brand ?? item.creator}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.status}</Badge>
                    <span className="font-semibold text-sm">{formatCurrency(item.totalValueCents)}</span>
                    <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent payments */}
      {summary?.recentPayments?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Payments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.recentPayments.map((p: {
                id: string; netAmount: number; paidAt: string; contract?: { title: string };
              }) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{p.contract?.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</p>
                  </div>
                  <span className="font-semibold text-sm text-emerald-600">
                    +{formatCurrency(p.netAmount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

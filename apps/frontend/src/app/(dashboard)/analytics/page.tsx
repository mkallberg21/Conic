'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { api } from '@/lib/api';

export default function AnalyticsPage() {
  const { data: overview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get('/v1/analytics/overview').then((r) => r.data.data),
  });

  const { data: roiData } = useQuery({
    queryKey: ['analytics', 'roi'],
    queryFn: () => api.get('/v1/analytics/roi').then((r) => r.data.data),
  });

  const { data: engagementData } = useQuery({
    queryKey: ['analytics', 'engagement'],
    queryFn: () => api.get('/v1/analytics/engagement').then((r) => r.data.data),
  });

  const roiChart = roiData?.monthly ?? [];
  const engagementChart = engagementData?.byPlatform ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Campaign performance and ROI insights</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Total ROI</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{overview?.avgRoi ? `${overview.avgRoi.toFixed(0)}%` : '—'}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Total Impressions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{overview?.totalImpressions ? (overview.totalImpressions / 1000).toFixed(0) + 'K' : '—'}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Avg Engagement Rate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{overview?.avgEngagementRate ? `${overview.avgEngagementRate.toFixed(1)}%` : '—'}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Monthly ROI</CardTitle></CardHeader>
          <CardContent>
            {roiChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={roiChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="roi" stroke="#6366f1" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-60 items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Engagement by Platform</CardTitle></CardHeader>
          <CardContent>
            {engagementChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={engagementChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="platform" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#6366f1" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-60 items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

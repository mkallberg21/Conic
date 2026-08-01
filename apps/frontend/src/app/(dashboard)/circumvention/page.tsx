'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface Flag {
  id: string;
  kind: string;
  severity: 'low' | 'medium' | 'high';
  dealRoomId?: string | null;
  categories: string[];
  detail: string;
  createdAt: string;
}
interface Report {
  total: number;
  bySeverity: Record<string, number>;
  flags: Flag[];
}

const sevColor: Record<string, string> = {
  high: 'bg-red-600',
  medium: 'bg-amber-500',
  low: 'bg-slate-400',
};

export default function CircumventionPage() {
  const { data, isLoading } = useQuery<Report>({
    queryKey: ['circumvention', 'report'],
    queryFn: () => api.get('/v1/anti-circumvention/report').then((r) => r.data.data),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5 p-2">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldAlert className="h-6 w-6 text-primary" /> Platform integrity
        </h1>
        <p className="text-sm text-muted-foreground">
          Off-platform contact attempts detected in deal rooms. Contact details are automatically redacted; parties agree
          to a non-circumvention clause.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total flags</p><p className="text-2xl font-bold">{data?.total ?? 0}</p></CardContent></Card>
        {(['high', 'medium', 'low'] as const).map((s) => (
          <Card key={s}><CardContent className="p-4"><p className="text-xs capitalize text-muted-foreground">{s} severity</p><p className="text-2xl font-bold">{data?.bySeverity?.[s] ?? 0}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Recent flags</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(!data || data.flags.length === 0) && (
            <p className="flex items-center gap-2 text-sm text-emerald-700"><ShieldCheck className="h-4 w-4" /> No circumvention attempts detected.</p>
          )}
          {data?.flags.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
              <Badge className={sevColor[f.severity]}>{f.severity}</Badge>
              <span className="font-medium">{f.categories.join(', ')}</span>
              <span className="text-muted-foreground">{f.detail}</span>
              <span className="ml-auto text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { GraduationCap, ShieldCheck, Users, FileWarning, ClipboardCheck, Check } from 'lucide-react';

type InstitutionPlan = 'NONE' | 'CAMPUS' | 'DEPARTMENT' | 'ENTERPRISE';
interface Entitlements { label: string; priceCents: number; athletes: number; sports: number; prioritySupport: boolean }
interface PlanState {
  plan: InstitutionPlan;
  status: string;
  currentPeriodEnd: string | null;
  entitlements: Entitlements;
  usage: { athletes: number };
  catalog: Record<InstitutionPlan, Entitlements>;
}
interface Overview {
  athletes: number;
  activeDeals: number;
  flaggedDeals: number;
  disclosures: { total: number; pending: number; approved: number; complianceRate: number };
  recent: { id: string; athlete: string; brandName: string; dealType: string; status: string; createdAt: string }[];
}

const ORDER: InstitutionPlan[] = ['NONE', 'CAMPUS', 'DEPARTMENT', 'ENTERPRISE'];
const PAID: InstitutionPlan[] = ['CAMPUS', 'DEPARTMENT', 'ENTERPRISE'];
const price = (c: number) => (c === 0 ? '$0' : `$${(c / 100).toLocaleString()}`);
const cap = (n: number) => (n >= 999 ? 'Unlimited' : `${n}`);

export default function SchoolPage() {
  const qc = useQueryClient();
  const { data: uni, isLoading: uniLoading } = useQuery<{ id: string; name: string; shortName?: string } | null>({
    queryKey: ['school', 'me'],
    queryFn: () => api.get('/v1/school-billing/me').then((r) => r.data.data),
  });
  const universityId = uni?.id;

  const { data: plan } = useQuery<PlanState>({
    queryKey: ['school', 'plan', universityId],
    enabled: !!universityId,
    queryFn: () => api.get(`/v1/school-billing/${universityId}/plan`).then((r) => r.data.data),
  });
  const { data: overview } = useQuery<Overview>({
    queryKey: ['school', 'overview', universityId],
    enabled: !!universityId,
    queryFn: () => api.get(`/v1/school-billing/${universityId}/compliance-overview`).then((r) => r.data.data),
  });

  const checkout = useMutation({
    mutationFn: (p: InstitutionPlan) => api.post('/v1/school-billing/checkout', { universityId, plan: p }).then((r) => r.data.data),
    onSuccess: (res: { activated: boolean; checkoutUrl?: string }) => {
      if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      toast({ title: 'Plan updated 🎓' });
      qc.invalidateQueries({ queryKey: ['school', 'plan', universityId] });
    },
    onError: (e: unknown) => toast({ title: 'Update failed', description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Try again.', variant: 'destructive' }),
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/v1/school-billing/cancel?universityId=${universityId}`),
    onSuccess: () => { toast({ title: 'Plan canceled' }); qc.invalidateQueries({ queryKey: ['school', 'plan', universityId] }); },
  });

  const [manualId, setManualId] = useState('');

  if (uniLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  // Compliance officers auto-resolve their university; other roles enter an id.
  if (!universityId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><GraduationCap className="h-6 w-6 text-primary" /> Institution compliance</h1>
        <p className="text-sm text-muted-foreground">Enter your university ID to open its compliance command-center.</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
            placeholder="University ID"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <Button onClick={() => qc.setQueryData(['school', 'me'], { id: manualId })} disabled={!manualId}>Open</Button>
        </div>
      </div>
    );
  }

  const current = plan?.plan ?? 'NONE';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GraduationCap className="h-6 w-6 text-primary" /> {uni?.name ?? 'Institution'} compliance
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time NIL disclosure oversight for your athletic program. {plan && `${plan.usage.athletes} of ${cap(plan.entitlements.athletes)} athlete seats in use.`}
        </p>
      </div>

      {/* Command-center metrics */}
      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Users className="h-5 w-5" />} label="Athletes" value={overview.athletes} />
          <Metric icon={<ClipboardCheck className="h-5 w-5" />} label="Active deals" value={overview.activeDeals} />
          <Metric
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Disclosure compliance"
            value={`${overview.disclosures.complianceRate}%`}
            hint={`${overview.disclosures.pending} pending review`}
          />
          <Metric
            icon={<FileWarning className="h-5 w-5" />}
            label="Flagged deals"
            value={overview.flaggedDeals}
            tone={overview.flaggedDeals > 0 ? 'warn' : undefined}
          />
        </div>
      )}

      {/* Recent disclosures */}
      {overview && overview.recent.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent disclosures</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {overview.recent.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{d.athlete}</span>
                  <span className="text-muted-foreground"> · {d.brandName} · {d.dealType}</span>
                </div>
                <Badge variant={d.status === 'APPROVED' ? 'default' : d.status === 'PENDING_REVIEW' ? 'outline' : 'secondary'}>
                  {d.status.replace('_', ' ').toLowerCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Institution plan</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PAID.map((p) => {
            const e = plan?.catalog[p];
            if (!e) return null;
            const isCurrent = p === current;
            return (
              <Card key={p} className={isCurrent ? 'border-primary' : p === 'DEPARTMENT' ? 'border-primary/40' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {e.label}
                    {isCurrent && <Badge className="bg-primary">Current</Badge>}
                    {p === 'DEPARTMENT' && !isCurrent && <Badge variant="outline">Popular</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-bold">{price(e.priceCents)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />{cap(e.athletes)} athletes</li>
                    <li className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-muted-foreground" />{cap(e.sports)} sport{e.sports === 1 ? '' : 's'}</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-muted-foreground" />{e.prioritySupport ? 'Priority support' : 'Standard support'}</li>
                  </ul>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Cancel plan</Button>
                  ) : (
                    <Button className="w-full" disabled={checkout.isPending} onClick={() => checkout.mutate(p)}>
                      {ORDER.indexOf(p) > ORDER.indexOf(current) ? 'Upgrade' : 'Switch'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        {current !== 'NONE' && plan?.currentPeriodEnd && (
          <p className="mt-3 text-xs text-muted-foreground">Renews {new Date(plan.currentPeriodEnd).toLocaleDateString()}.</p>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string | number; hint?: string; tone?: 'warn' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`mb-2 flex items-center gap-2 text-sm ${tone === 'warn' ? 'text-amber-600' : 'text-muted-foreground'}`}>{icon}{label}</div>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

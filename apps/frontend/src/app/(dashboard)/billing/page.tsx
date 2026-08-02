'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Building2, Check, Users, Megaphone } from 'lucide-react';

type BrandPlan = 'FREE' | 'STARTER' | 'GROWTH' | 'SCALE';
interface Entitlements { label: string; priceCents: number; seats: number; activeCampaigns: number }
interface BillingState {
  plan: BrandPlan;
  status: string;
  currentPeriodEnd: string | null;
  entitlements: Entitlements;
  usage: { activeCampaigns: number };
  catalog: Record<BrandPlan, Entitlements>;
}

const ORDER: BrandPlan[] = ['FREE', 'STARTER', 'GROWTH', 'SCALE'];
const price = (c: number) => (c === 0 ? '$0' : `$${(c / 100).toLocaleString()}`);
const cap = (n: number) => (n >= 999 ? 'Unlimited' : `${n}`);

export default function BillingPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<BillingState>({
    queryKey: ['brand-billing', 'me'],
    queryFn: () => api.get('/v1/brand-billing/me').then((r) => r.data.data),
  });

  const checkout = useMutation({
    mutationFn: (plan: BrandPlan) => api.post('/v1/brand-billing/checkout', { plan }).then((r) => r.data.data),
    onSuccess: (res: { activated: boolean; checkoutUrl?: string }) => {
      if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      toast({ title: 'Plan updated 🎉' });
      qc.invalidateQueries({ queryKey: ['brand-billing', 'me'] });
    },
    onError: (e: unknown) => toast({ title: 'Upgrade failed', description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Try again.', variant: 'destructive' }),
  });
  const cancel = useMutation({
    mutationFn: () => api.post('/v1/brand-billing/cancel'),
    onSuccess: () => { toast({ title: 'Downgraded to Free' }); qc.invalidateQueries({ queryKey: ['brand-billing', 'me'] }); },
  });

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const current = data.plan;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Building2 className="h-6 w-6 text-primary" /> Billing &amp; plans</h1>
        <p className="text-sm text-muted-foreground">Priced on seats and active-campaign volume. You’re using {data.usage.activeCampaigns} of {cap(data.entitlements.activeCampaigns)} active campaigns.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {ORDER.map((plan) => {
          const e = data.catalog[plan];
          const isCurrent = plan === current;
          const isUpgrade = ORDER.indexOf(plan) > ORDER.indexOf(current);
          return (
            <Card key={plan} className={isCurrent ? 'border-primary' : plan === 'GROWTH' ? 'border-primary/40' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {e.label}
                  {isCurrent && <Badge className="bg-primary">Current</Badge>}
                  {plan === 'GROWTH' && !isCurrent && <Badge variant="outline">Popular</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">{price(e.priceCents)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />{cap(e.seats)} seat{e.seats === 1 ? '' : 's'}</li>
                  <li className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-muted-foreground" />{cap(e.activeCampaigns)} active campaign{e.activeCampaigns === 1 ? '' : 's'}</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-muted-foreground" />Discovery, contracts &amp; escrow</li>
                </ul>
                {isCurrent ? (
                  plan !== 'FREE' ? (
                    <Button variant="outline" className="w-full" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Downgrade to Free</Button>
                  ) : null
                ) : isUpgrade ? (
                  <Button className="w-full" disabled={checkout.isPending} onClick={() => checkout.mutate(plan)}>Upgrade</Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled={checkout.isPending} onClick={() => checkout.mutate(plan)}>Switch</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {current !== 'FREE' && data.currentPeriodEnd && (
        <p className="text-xs text-muted-foreground">Renews {new Date(data.currentPeriodEnd).toLocaleDateString()}.</p>
      )}
    </div>
  );
}

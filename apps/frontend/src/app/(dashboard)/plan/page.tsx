'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Check, Sparkles, Eye, TrendingUp, BadgeCheck, MessageSquare } from 'lucide-react';

interface PlanState {
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  status: string;
  isPro: boolean;
  currentPeriodEnd: string | null;
  dmCredits: number;
}

const FREE_FEATURES = [
  'Full profile + unlimited social links',
  'Appear in brand discovery search',
  'See how many brands viewed & saved you',
];
const PRO_FEATURES = [
  { icon: Eye, text: 'See exactly which brands viewed & saved you' },
  { icon: TrendingUp, text: 'Boosted placement in discovery' },
  { icon: BadgeCheck, text: 'Pro badge on your profile' },
  { icon: Sparkles, text: 'Repeat-visit insights and trends' },
];

export default function PlanPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<PlanState>({
    queryKey: ['subscription', 'me'],
    queryFn: () => api.get('/v1/subscription/me').then((r) => r.data.data),
  });

  const checkout = useMutation({
    mutationFn: (plan: 'PRO') => api.post('/v1/subscription/checkout', { plan }).then((r) => r.data.data),
    onSuccess: (res: { activated: boolean; checkoutUrl?: string }) => {
      if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      toast({ title: 'You’re on Pro 🎉', description: 'Enjoy your new insights.' });
      qc.invalidateQueries({ queryKey: ['subscription', 'me'] });
    },
    onError: (e: unknown) =>
      toast({ title: 'Upgrade failed', description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Try again.', variant: 'destructive' }),
  });

  const cancel = useMutation({
    mutationFn: () => api.post('/v1/subscription/cancel'),
    onSuccess: () => { toast({ title: 'Switched to Free' }); qc.invalidateQueries({ queryKey: ['subscription', 'me'] }); },
  });

  const isPro = data?.isPro;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" /> Your plan
        </h1>
        <p className="text-sm text-muted-foreground">
          Upgrade to Pro to see exactly which brands are interested in you — and get discovered more.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Free */}
          <Card className={!isPro ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Free {!isPro && <Badge variant="outline">Current plan</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-bold">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <ul className="space-y-2 text-sm">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-muted-foreground" />{f}</li>
                ))}
              </ul>
              {isPro && (
                <Button variant="outline" className="w-full" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                  Switch to Free
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className={isPro ? 'border-primary' : 'border-primary/40 bg-gradient-to-br from-primary/5 to-transparent'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Pro</span>
                {isPro && <Badge className="bg-primary">Current plan</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-bold">$12<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <ul className="space-y-2 text-sm">
                {PRO_FEATURES.map((f) => (
                  <li key={f.text} className="flex items-start gap-2"><f.icon className="mt-0.5 h-4 w-4 text-primary" />{f.text}</li>
                ))}
              </ul>
              {!isPro && (
                <Button className="w-full" disabled={checkout.isPending} onClick={() => checkout.mutate('PRO')}>
                  {checkout.isPending ? 'Starting…' : 'Upgrade to Pro'}
                </Button>
              )}
              {isPro && data?.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground">Renews {new Date(data.currentPeriodEnd).toLocaleDateString()}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-muted/30">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <MessageSquare className="mt-0.5 h-4 w-4" />
          <span><b className="text-foreground">Coming soon:</b> a higher tier that lets you send direct messages to brands to pitch your interest.</span>
        </CardContent>
      </Card>
    </div>
  );
}

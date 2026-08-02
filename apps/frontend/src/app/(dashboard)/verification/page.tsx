'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { BadgeCheck, ScanFace, IdCard, Building2, ShieldCheck, Clock, XCircle } from 'lucide-react';

type IdentityStatus = 'NOT_STARTED' | 'PENDING' | 'NEEDS_INPUT' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'REVIEW';

interface AgeStatus {
  ageVerified: boolean;
  method: 'ESTIMATION' | 'DOCUMENT' | null;
  verifiedAt: string | null;
  current: { id: string; status: IdentityStatus; method: string; isAdult: boolean | null } | null;
}
interface KybStatus {
  tier: 'NONE' | 'BASIC' | 'ENHANCED';
  status: IdentityStatus;
  check: { legalName: string; country: string; failureReason?: string | null } | null;
}

const apiErr = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong';

function StatusPill({ status }: { status: IdentityStatus }) {
  const map: Record<IdentityStatus, { label: string; cls: string; icon?: React.ReactNode }> = {
    APPROVED: { label: 'Verified', cls: 'bg-emerald-600', icon: <ShieldCheck className="mr-1 h-3 w-3" /> },
    PENDING: { label: 'In progress', cls: 'bg-amber-500', icon: <Clock className="mr-1 h-3 w-3" /> },
    REVIEW: { label: 'Under review', cls: 'bg-amber-500', icon: <Clock className="mr-1 h-3 w-3" /> },
    NEEDS_INPUT: { label: 'Needs input', cls: 'bg-amber-500' },
    DECLINED: { label: 'Declined', cls: 'bg-red-600', icon: <XCircle className="mr-1 h-3 w-3" /> },
    EXPIRED: { label: 'Expired', cls: 'bg-slate-400' },
    NOT_STARTED: { label: 'Not started', cls: 'bg-slate-400' },
  };
  const s = map[status];
  return <Badge className={s.cls}>{s.icon}{s.label}</Badge>;
}

export default function VerificationPage() {
  const { user } = useAuth();
  const role = user?.role ?? 'BRAND';
  const isInfluencer = role === 'CREATOR' || role === 'ATHLETE';
  const isBrand = role === 'BRAND';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BadgeCheck className="h-6 w-6 text-primary" /> Verification
        </h1>
        <p className="text-sm text-muted-foreground">
          Verify your identity so the platform stays a safe place to do deals. This is how we confirm real
          people and real brands — and keep minors protected.
        </p>
      </div>

      {isInfluencer && <AgeSection />}
      {isBrand && <KybSection />}
      {!isInfluencer && !isBrand && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No verification is required for your account type.</CardContent></Card>
      )}
    </div>
  );
}

function AgeSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<AgeStatus>({
    queryKey: ['verification', 'age'],
    queryFn: () => api.get('/v1/verification/age/status').then((r) => r.data.data),
  });

  const start = useMutation({
    mutationFn: (method: 'ESTIMATION' | 'DOCUMENT') =>
      api.post('/v1/verification/age/start', { method }).then((r) => r.data.data),
    onSuccess: (res: { status: IdentityStatus; redirectUrl?: string }) => {
      if (res.redirectUrl) { window.location.href = res.redirectUrl; return; }
      toast({
        title: res.status === 'APPROVED' ? 'Age verified' : 'Verification started',
        description: res.status === 'APPROVED' ? 'You’re all set.' : 'We’ll update your status when it completes.',
      });
      qc.invalidateQueries({ queryKey: ['verification', 'age'] });
    },
    onError: (e) => toast({ title: 'Could not start', description: apiErr(e), variant: 'destructive' }),
  });

  if (isLoading) return <Card><CardContent className="p-6 text-muted-foreground">Loading…</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2"><ScanFace className="h-5 w-5" /> Age verification</span>
          {data?.ageVerified
            ? <Badge className="bg-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" />Verified{data.method === 'DOCUMENT' ? ' · ID' : ''}</Badge>
            : data?.current ? <StatusPill status={data.current.status} /> : <StatusPill status="NOT_STARTED" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A quick age check lets you appear in discovery and sign agreements. A full ID check is required
          before you can receive a payout.
        </p>
        {data?.current?.status === 'DECLINED' && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            Your last check was declined. You can try again below.
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant={data?.ageVerified ? 'outline' : 'default'} disabled={start.isPending}
            onClick={() => start.mutate('ESTIMATION')}>
            <ScanFace className="mr-1 h-4 w-4" /> Quick age check
          </Button>
          <Button variant="outline" disabled={start.isPending} onClick={() => start.mutate('DOCUMENT')}>
            <IdCard className="mr-1 h-4 w-4" /> Full ID verification
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function KybSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<KybStatus>({
    queryKey: ['verification', 'kyb'],
    queryFn: () => api.get('/v1/verification/business/status').then((r) => r.data.data),
  });

  const [form, setForm] = useState({ legalName: '', country: 'US', registrationNumber: '', domain: '', tier: 'BASIC' as 'BASIC' | 'ENHANCED' });
  const [youthSafety, setYouthSafety] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const start = useMutation({
    mutationFn: () =>
      api.post('/v1/verification/business/start', {
        legalName: form.legalName,
        country: form.country,
        tier: form.tier,
        registrationNumber: form.registrationNumber || undefined,
        domain: form.domain || undefined,
        youthSafetyAccepted: form.tier === 'ENHANCED' ? youthSafety : undefined,
      }).then((r) => r.data.data),
    onSuccess: (res: KybStatus) => {
      toast({
        title: res.status === 'APPROVED' ? `Verified — ${res.tier} tier granted` : 'Submitted for review',
        description: res.status === 'APPROVED' ? 'Your business is verified.' : 'We’ll update your status when review completes.',
      });
      qc.invalidateQueries({ queryKey: ['verification', 'kyb'] });
    },
    onError: (e) => toast({ title: 'Could not submit', description: apiErr(e), variant: 'destructive' }),
  });

  if (isLoading) return <Card><CardContent className="p-6 text-muted-foreground">Loading…</CardContent></Card>;

  const tierBadge = data?.tier === 'ENHANCED' ? 'bg-emerald-600' : data?.tier === 'BASIC' ? 'bg-blue-600' : 'bg-slate-400';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Business verification</span>
          <div className="flex items-center gap-2">
            <Badge className={tierBadge}>{data?.tier ?? 'NONE'} tier</Badge>
            {data?.status && data.status !== 'NOT_STARTED' && <StatusPill status={data.status} />}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <b>BASIC</b> lets you contact adult creators and fund deals. <b>ENHANCED</b> is required to work
          with anyone under 18 and needs you to accept our youth-safety terms.
        </p>

        {data?.check?.failureReason && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {data.check.failureReason}
          </div>
        )}

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="legalName">Legal business name</Label>
            <Input id="legalName" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="Acme Brands, Inc." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" maxLength={2} value={form.country} onChange={(e) => set('country', e.target.value.toUpperCase())} placeholder="US" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg">Registration / EIN</Label>
            <Input id="reg" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="domain">Web domain</Label>
            <Input id="domain" value={form.domain} onChange={(e) => set('domain', e.target.value)} placeholder="acme.com" />
          </div>
          <div className="space-y-2">
            <Label>Access tier</Label>
            <Select value={form.tier} onValueChange={(v) => set('tier', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BASIC">Basic — contact adult creators</SelectItem>
                <SelectItem value="ENHANCED">Enhanced — also contact minors</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.tier === 'ENHANCED' && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <Switch checked={youthSafety} onCheckedChange={setYouthSafety} id="youth" />
            <Label htmlFor="youth" className="text-sm text-amber-900 dark:text-amber-200">
              I accept the youth-safety terms: no restricted products to minors, all contact stays on-platform
              and visible to guardians, and I understand every minor agreement requires guardian approval.
            </Label>
          </div>
        )}

        <Button
          disabled={start.isPending || !form.legalName || !form.country || (form.tier === 'ENHANCED' && !youthSafety)}
          onClick={() => start.mutate()}>
          {start.isPending ? 'Submitting…' : 'Submit for verification'}
        </Button>
      </CardContent>
    </Card>
  );
}

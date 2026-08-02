'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Plus, Users, CheckCircle2, X } from 'lucide-react';

interface Brief { id: string; title: string; budgetCents: number; currency: string; status: string; _count: { applications: number }; }
interface Applicant {
  id: string; pitch: string; status: string; proposedRateCents: number | null;
  creator?: { handle: string; followersCount: number; isPro: boolean; user: { firstName: string; lastName: string } } | null;
  athlete?: { sport: string; followersCount: number; isPro: boolean; user: { firstName: string; lastName: string } } | null;
}
const money = (c: number, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(c / 100);

export default function BriefsPage() {
  const qc = useQueryClient();
  const briefs = useQuery<Brief[]>({ queryKey: ['marketplace', 'my-briefs'], queryFn: () => api.get('/v1/marketplace/briefs/mine').then((r) => r.data.data) });
  const [openBrief, setOpenBrief] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', budget: '', deliverableType: '', targetType: 'both' });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () => api.post('/v1/marketplace/briefs', {
      title: form.title, description: form.description, budgetCents: Math.round(parseFloat(form.budget || '0') * 100),
      deliverableType: form.deliverableType || undefined, targetType: form.targetType,
    }),
    onSuccess: () => { toast({ title: 'Brief posted' }); setForm({ title: '', description: '', budget: '', deliverableType: '', targetType: 'both' }); qc.invalidateQueries({ queryKey: ['marketplace', 'my-briefs'] }); },
    onError: (e: unknown) => toast({ title: 'Couldn’t post', description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Try again.', variant: 'destructive' }),
  });

  const applicants = useQuery<Applicant[]>({
    queryKey: ['marketplace', 'applications', openBrief],
    queryFn: () => api.get(`/v1/marketplace/briefs/${openBrief}/applications`).then((r) => r.data.data),
    enabled: !!openBrief,
  });
  const respond = useMutation({
    mutationFn: (v: { id: string; decision: string }) => api.patch(`/v1/marketplace/applications/${v.id}/respond`, { decision: v.decision }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketplace', 'applications', openBrief] }); qc.invalidateQueries({ queryKey: ['marketplace', 'my-briefs'] }); },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Megaphone className="h-6 w-6 text-primary" /> Open briefs</h1>
        <p className="text-sm text-muted-foreground">Post an opportunity and let creators &amp; athletes come to you.</p>
      </div>

      {/* Post a brief */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5" /> Post a brief</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="t">Title</Label><Input id="t" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. UGC reel for our summer launch" /></div>
            <div className="space-y-1"><Label htmlFor="bud">Budget ($)</Label><Input id="bud" type="number" value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="500" /></div>
            <div className="space-y-1"><Label htmlFor="del">Deliverable</Label><Input id="del" value={form.deliverableType} onChange={(e) => set('deliverableType', e.target.value)} placeholder="reel / post / UGC video" /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="d">What you need</Label><Textarea id="d" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe the deliverable, vibe, timeline…" /></div>
          </div>
          <Button disabled={!form.title || !form.description || !form.budget || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Posting…' : 'Post brief'}
          </Button>
        </CardContent>
      </Card>

      {/* My briefs */}
      <div className="space-y-3">
        {briefs.data?.map((b) => (
          <Card key={b.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{money(b.budgetCents, b.currency)} • {b._count.applications} application{b._count.applications === 1 ? '' : 's'}</p>
                </div>
                <Badge variant={b.status === 'OPEN' ? 'default' : 'secondary'}>{b.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => setOpenBrief(openBrief === b.id ? null : b.id)}>
                  <Users className="mr-1 h-4 w-4" /> {openBrief === b.id ? 'Hide' : 'View'} applicants
                </Button>
              </div>

              {openBrief === b.id && (
                <div className="space-y-2 border-t pt-3">
                  {applicants.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                  {applicants.data?.length === 0 && <p className="text-sm text-muted-foreground">No applicants yet.</p>}
                  {applicants.data?.map((a) => {
                    const who = a.creator ?? a.athlete;
                    const name = who ? `${who.user.firstName} ${who.user.lastName}` : 'Applicant';
                    return (
                      <div key={a.id} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{name}</span>
                          {who?.isPro && <Badge className="bg-primary text-[10px]">PRO</Badge>}
                          <span className="text-xs text-muted-foreground">{a.creator ? `@${a.creator.handle}` : a.athlete?.sport} • {(who?.followersCount ?? 0).toLocaleString()} followers</span>
                          {a.proposedRateCents != null && <Badge variant="outline" className="ml-auto">{money(a.proposedRateCents)}</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{a.pitch}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="secondary">{a.status.toLowerCase()}</Badge>
                          {a.status !== 'ACCEPTED' && a.status !== 'WITHDRAWN' && (
                            <div className="ml-auto flex gap-2">
                              <Button size="sm" variant="ghost" disabled={respond.isPending} onClick={() => respond.mutate({ id: a.id, decision: 'DECLINED' })}><X className="mr-1 h-3.5 w-3.5" />Decline</Button>
                              <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ id: a.id, decision: 'SHORTLISTED' })}>Shortlist</Button>
                              <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate({ id: a.id, decision: 'ACCEPTED' })}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Accept</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Send, Clock, CheckCircle2 } from 'lucide-react';

interface Brief {
  id: string; title: string; description: string; budgetCents: number; currency: string;
  deliverableType?: string | null; platforms: string[]; niche: string[]; sport?: string | null;
  deadline?: string | null; myApplicationStatus: string | null;
  brand: { companyName: string; logoUrl: string | null; industry: string | null };
}
interface MyApplication {
  id: string; pitch: string; status: string; createdAt: string;
  brief: { title: string; budgetCents: number; brand: { companyName: string } };
}

const money = (c: number, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(c / 100);
const statusColor: Record<string, string> = { PENDING: 'bg-amber-500', SHORTLISTED: 'bg-blue-600', ACCEPTED: 'bg-emerald-600', DECLINED: 'bg-red-600', WITHDRAWN: 'bg-slate-400' };

export default function OpportunitiesPage() {
  const qc = useQueryClient();
  const briefs = useQuery<Brief[]>({ queryKey: ['marketplace', 'briefs'], queryFn: () => api.get('/v1/marketplace/briefs').then((r) => r.data.data) });
  const mine = useQuery<MyApplication[]>({ queryKey: ['marketplace', 'my-applications'], queryFn: () => api.get('/v1/marketplace/applications/mine').then((r) => r.data.data) });

  const [pitch, setPitch] = useState('');
  const [rate, setRate] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: (briefId: string) => api.post(`/v1/marketplace/briefs/${briefId}/apply`, {
      pitch, proposedRateCents: rate ? Math.round(parseFloat(rate) * 100) : undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Application sent', description: 'The brand will see your pitch.' });
      setPitch(''); setRate(''); setOpenId(null);
      qc.invalidateQueries({ queryKey: ['marketplace'] });
    },
    onError: (e: unknown) => toast({ title: 'Couldn’t apply', description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Try again.', variant: 'destructive' }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Megaphone className="h-6 w-6 text-primary" /> Opportunities</h1>
        <p className="text-sm text-muted-foreground">Open briefs from brands. Apply with a short pitch — no minimum following required.</p>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open briefs</TabsTrigger>
          <TabsTrigger value="mine">My applications</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-3 pt-4">
          {briefs.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {briefs.data?.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No open opportunities right now — check back soon.</CardContent></Card>}
          {briefs.data?.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs font-semibold">{b.brand.companyName.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.brand.companyName}{b.brand.industry ? ` • ${b.brand.industry}` : ''}</p>
                  </div>
                  <Badge className="bg-emerald-600 shrink-0">{money(b.budgetCents, b.currency)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{b.description}</p>
                <div className="flex flex-wrap gap-2">
                  {b.deliverableType && <Badge variant="secondary">{b.deliverableType}</Badge>}
                  {b.platforms.slice(0, 3).map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
                  {b.sport && <Badge variant="outline">{b.sport}</Badge>}
                </div>
                <div className="flex items-center gap-3">
                  {b.myApplicationStatus ? (
                    <Badge className={statusColor[b.myApplicationStatus]}>Applied · {b.myApplicationStatus.toLowerCase()}</Badge>
                  ) : (
                    <Dialog open={openId === b.id} onOpenChange={(o) => { setOpenId(o ? b.id : null); if (!o) { setPitch(''); setRate(''); } }}>
                      <DialogTrigger asChild><Button size="sm"><Send className="mr-1 h-4 w-4" /> Apply</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Apply — {b.title}</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label htmlFor="pitch">Your pitch</Label>
                            <Textarea id="pitch" rows={4} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Why you’re a great fit, links to relevant work…" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="rate">Your rate (optional, $)</Label>
                            <Input id="rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 500" />
                          </div>
                          <Button className="w-full" disabled={!pitch || apply.isPending} onClick={() => apply.mutate(b.id)}>
                            {apply.isPending ? 'Sending…' : 'Send application'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  {b.deadline && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> by {new Date(b.deadline).toLocaleDateString()}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3 pt-4">
          {mine.data?.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">You haven’t applied to anything yet.</CardContent></Card>}
          {mine.data?.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.brief.title}</p>
                  <p className="text-xs text-muted-foreground">{a.brief.brand.companyName} • applied {new Date(a.createdAt).toLocaleDateString()}</p>
                </div>
                <Badge className={statusColor[a.status]}>{a.status === 'ACCEPTED' && <CheckCircle2 className="mr-1 h-3 w-3" />}{a.status.toLowerCase()}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

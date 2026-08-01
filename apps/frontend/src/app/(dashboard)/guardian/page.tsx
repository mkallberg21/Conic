'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Heart, ShieldCheck, MessageSquare, UserCircle } from 'lucide-react';

interface Minor {
  id: string;
  relationship: string;
  athlete?: { user: { firstName: string; lastName: string } } | null;
  creator?: { user: { firstName: string; lastName: string } } | null;
}
interface Approval {
  id: string;
  resourceType: string;
  resourceId: string;
  status: string;
  requestedAt: string;
  expiresAt: string;
}
interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

const minorName = (m: Minor) => {
  const u = m.athlete?.user ?? m.creator?.user;
  return u ? `${u.firstName} ${u.lastName}` : 'Linked minor';
};

const RESOURCE_LABEL: Record<string, string> = { nil_deal: 'NIL deal', contract: 'Contract' };

export default function GuardianPortalPage() {
  const qc = useQueryClient();

  const minors = useQuery<Minor[]>({
    queryKey: ['guardian', 'minors'],
    queryFn: () => api.get('/v1/guardian/minors').then((r) => r.data.data),
  });
  const approvals = useQuery<Approval[]>({
    queryKey: ['guardian', 'approvals'],
    queryFn: () => api.get('/v1/guardian/approvals/pending').then((r) => r.data.data),
  });
  const notifications = useQuery<Notification[]>({
    queryKey: ['guardian', 'notifications'],
    queryFn: () => api.get('/v1/notifications').then((r) => r.data.data),
  });

  const respond = useMutation({
    mutationFn: (vars: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      api.post(`/v1/guardian/approvals/${vars.id}/respond`, { decision: vars.decision }),
    onSuccess: (_d, vars) => {
      toast({ title: vars.decision === 'APPROVED' ? 'Agreement approved' : 'Agreement rejected' });
      qc.invalidateQueries({ queryKey: ['guardian', 'approvals'] });
    },
    onError: (e: unknown) =>
      toast({
        title: 'Error',
        description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed',
        variant: 'destructive',
      }),
  });

  const messages = (notifications.data ?? []).filter((n) => n.type.startsWith('GUARDIAN_'));

  return (
    <div className="space-y-6 p-2">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Heart className="h-6 w-6 text-primary" /> Guardian portal
        </h1>
        <p className="text-sm text-muted-foreground">
          Review and approve every agreement for the minors in your care, and see every message a brand sends them.
        </p>
      </div>

      {/* Pending approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" /> Agreements awaiting your approval
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvals.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {approvals.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing needs your approval right now.</p>
          )}
          {approvals.data?.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <Badge variant="secondary">{RESOURCE_LABEL[a.resourceType] ?? a.resourceType}</Badge>
              <span className="text-sm text-muted-foreground">
                Requested {new Date(a.requestedAt).toLocaleDateString()} · expires {new Date(a.expiresAt).toLocaleDateString()}
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: a.id, decision: 'REJECTED' })}>Reject</Button>
                <Button size="sm" disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: a.id, decision: 'APPROVED' })}>Approve</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Linked minors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><UserCircle className="h-5 w-5" /> Minors in your care</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {minors.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No minors linked yet. Accept an invite to get started.</p>
            )}
            {minors.data?.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="font-medium">{minorName(m)}</span>
                <Badge variant="outline" className="capitalize">{m.relationship.replace('_', ' ')}</Badge>
                <Badge className="ml-auto">{m.athlete ? 'Athlete' : 'Creator'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Mirrored communications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><MessageSquare className="h-5 w-5" /> Communications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">No brand communications yet. You’ll see a copy of everything here.</p>
            )}
            {messages.map((n) => (
              <div key={n.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{n.title}</p>
                <p className="text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

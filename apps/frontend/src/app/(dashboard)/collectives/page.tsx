'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, DollarSign, Heart, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const donationSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  amountCents: z.coerce.number().min(100),
  note: z.string().optional(),
});
type DonationForm = z.infer<typeof donationSchema>;

const memberSchema = z.object({
  athleteId: z.string().min(1),
  sharePercent: z.coerce.number().min(0).max(100),
});
type MemberForm = z.infer<typeof memberSchema>;

export default function CollectivesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: collectives } = useQuery({
    queryKey: ['collectives'],
    queryFn: () => api.get('/v1/collectives').then((r) => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['collectives', selectedId, 'summary'],
    queryFn: () => api.get(`/v1/collectives/${selectedId}/summary`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const donationForm = useForm<DonationForm>({ resolver: zodResolver(donationSchema) });
  const memberForm = useForm<MemberForm>({ resolver: zodResolver(memberSchema) });

  const recordDonation = useMutation({
    mutationFn: (values: DonationForm) =>
      api.post(`/v1/collectives/${selectedId}/donations`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collectives', selectedId] });
      donationForm.reset();
      toast({ title: 'Donation recorded' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to record donation', variant: 'destructive' }),
  });

  const addMember = useMutation({
    mutationFn: (values: MemberForm) =>
      api.post(`/v1/collectives/${selectedId}/members`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collectives', selectedId] });
      memberForm.reset();
      toast({ title: 'Athlete added to collective' });
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/v1/collectives/${selectedId}/members/${memberId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collectives', selectedId] }),
  });

  const list = collectives?.items ?? collectives ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">NIL Collectives</h1>
          <p className="text-muted-foreground">Manage collectives, donors, and athlete distributions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="space-y-3">
          {list.map((c: { id: string; name: string; totalFundsCents: number; _count?: { members: number } }) => (
            <Card
              key={c.id}
              className={`cursor-pointer transition-colors hover:border-primary ${selectedId === c.id ? 'border-primary' : ''}`}
              onClick={() => setSelectedId(c.id)}
            >
              <CardContent className="pt-4 space-y-1">
                <p className="font-semibold">{c.name}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {c._count?.members ?? 0} athletes
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> {formatCurrency(c.totalFundsCents ?? 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
          {list.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No collectives yet.</p>
          )}
        </div>

        {/* Detail */}
        {selectedId && detail ? (
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total Funds</p>
                  <p className="text-xl font-bold">{formatCurrency(detail.totalFundsCents ?? 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total Donors</p>
                  <p className="text-xl font-bold">{detail.donorCount ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Distributed</p>
                  <p className="text-xl font-bold">{formatCurrency(detail.distributedCents ?? 0)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Members */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Athletes</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-3 w-3 mr-1" /> Add Athlete</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Athlete to Collective</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">Athlete ID</label>
                          <Input {...memberForm.register('athleteId')} placeholder="cuid..." />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Share % (0–100)</label>
                          <Input type="number" {...memberForm.register('sharePercent')} />
                        </div>
                        <Button
                          className="w-full"
                          onClick={memberForm.handleSubmit((v) => addMember.mutate(v))}
                          disabled={addMember.isPending}
                        >
                          Add Member
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {detail.members?.map((m: {
                  id: string; sharePercent: number; status: string;
                  athlete: { user: { firstName: string; lastName: string } };
                }) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">
                        {m.athlete.user.firstName} {m.athlete.user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.sharePercent}% share</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{m.status}</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeMember.mutate(m.id)}
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Record Donation */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4" /> Record Donation
              </CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Donor Name</label>
                    <Input {...donationForm.register('displayName')} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input type="email" {...donationForm.register('email')} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Amount ($)</label>
                    <Input type="number" {...donationForm.register('amountCents')} placeholder="in cents" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Note</label>
                    <Input {...donationForm.register('note')} />
                  </div>
                </div>
                <Button
                  className="mt-3 w-full"
                  onClick={donationForm.handleSubmit((v) => recordDonation.mutate(v))}
                  disabled={recordDonation.isPending}
                >
                  Record Donation
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center text-muted-foreground">
            Select a collective to view details.
          </div>
        )}
      </div>
    </div>
  );
}

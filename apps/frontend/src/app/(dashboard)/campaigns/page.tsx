'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PLANNING: 'secondary',
  ACTIVE: 'default',
  PAUSED: 'outline',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
};

const schema = z.object({
  name: z.string().min(3),
  description: z.string().min(10),
  budget: z.coerce.number().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  objectives: z.string().min(5),
  targetNiches: z.string().min(2),
});
type FormValues = z.infer<typeof schema>;

export default function CampaignsPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/v1/campaigns').then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post('/v1/campaigns', {
        ...values,
        budget: values.budget * 100,
        objectives: values.objectives.split(',').map((s) => s.trim()),
        targetNiches: values.targetNiches.split(',').map((s) => s.trim()),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign created', description: 'AI is generating your timeline…' });
      reset();
      setOpen(false);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create campaign', variant: 'destructive' }),
  });

  const campaigns = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">AI-managed influencer campaigns</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input placeholder="Summer Launch 2025" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="What is this campaign about?" {...register('description')} />
                {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Objectives (comma-separated)</Label>
                <Input placeholder="brand awareness, lead generation" {...register('objectives')} />
              </div>
              <div className="space-y-2">
                <Label>Target Niches (comma-separated)</Label>
                <Input placeholder="fashion, lifestyle, beauty" {...register('targetNiches')} />
              </div>
              <div className="space-y-2">
                <Label>Budget ($)</Label>
                <Input type="number" min={1} {...register('budget')} />
                {errors.budget && <p className="text-xs text-destructive">{errors.budget.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" {...register('startDate')} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" {...register('endDate')} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Campaign'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All Campaigns ({campaigns.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c: Record<string, unknown>) => (
                <TableRow key={c.id as string}>
                  <TableCell className="font-medium">{c.name as string}</TableCell>
                  <TableCell><Badge variant={statusColor[c.status as string] ?? 'secondary'}>{c.status as string}</Badge></TableCell>
                  <TableCell>{formatCurrency(c.budget as number)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.startDate ? formatDate(c.startDate as string) : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.endDate ? formatDate(c.endDate as string) : '—'}</TableCell>
                </TableRow>
              ))}
              {campaigns.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No campaigns yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

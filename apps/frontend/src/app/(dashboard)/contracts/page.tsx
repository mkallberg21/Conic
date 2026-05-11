'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_SIGNATURES: 'outline',
  ACTIVE: 'default',
  COMPLETED: 'default',
  TERMINATED: 'destructive',
  DISPUTED: 'destructive',
};

const schema = z.object({
  title: z.string().min(3),
  creatorId: z.string().min(1, 'Creator ID required'),
  deliverables: z.string().min(10),
  totalValue: z.coerce.number().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export default function ContractsPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get('/v1/contracts').then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post('/v1/contracts', { ...values, totalValue: values.totalValue * 100 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contract created', description: 'AI is generating contract content…' });
      reset();
      setOpen(false);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create contract', variant: 'destructive' }),
  });

  const signMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/contracts/${id}/sign`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contract signed' });
    },
  });

  const contracts = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
          <p className="text-muted-foreground">Manage AI-generated creator contracts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Contract</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Contract</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="Instagram Campaign Q1 2025" {...register('title')} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Creator ID</Label>
                <Input placeholder="creator-uuid" {...register('creatorId')} />
                {errors.creatorId && <p className="text-xs text-destructive">{errors.creatorId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Deliverables Description</Label>
                <Input placeholder="3 Instagram posts, 5 stories…" {...register('deliverables')} />
                {errors.deliverables && <p className="text-xs text-destructive">{errors.deliverables.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Value ($)</Label>
                  <Input type="number" min={1} {...register('totalValue')} />
                  {errors.totalValue && <p className="text-xs text-destructive">{errors.totalValue.message}</p>}
                </div>
                <div />
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
                {createMutation.isPending ? 'Generating…' : 'Generate Contract'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All Contracts ({contracts.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c: Record<string, unknown>) => (
                <TableRow key={c.id as string}>
                  <TableCell className="font-medium">
                    <Link href={`/contracts/${c.id as string}`} className="hover:underline">
                      {c.title as string}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant={statusColor[c.status as string] ?? 'secondary'}>{c.status as string}</Badge></TableCell>
                  <TableCell>{formatCurrency(c.totalValue as number)}</TableCell>
                  <TableCell>
                    <Badge variant={(c.riskScore as number) > 70 ? 'destructive' : 'secondary'}>
                      {c.riskScore != null ? `${c.riskScore}/100` : 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(c.createdAt as string)}</TableCell>
                  <TableCell>
                    {(c.status === 'PENDING_SIGNATURES' || c.status === 'DRAFT') && (
                      <Button size="sm" variant="outline" onClick={() => signMutation.mutate(c.id as string)}>
                        Sign
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No contracts yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

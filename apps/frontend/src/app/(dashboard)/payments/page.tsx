'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  IN_ESCROW: 'outline',
  RELEASED: 'default',
  COMPLETED: 'default',
  FAILED: 'destructive',
  REFUNDED: 'destructive',
};

export default function PaymentsPage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.get('/v1/payments').then((r) => r.data.data),
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/payments/${id}/release`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: 'Payment released', description: 'Funds transferred to creator' });
    },
    onError: () => toast({ title: 'Error', description: 'Release failed', variant: 'destructive' }),
  });

  const payments = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Manage milestone payments and payouts</p>
      </div>

      <Card>
        <CardHeader><CardTitle>All Payments ({payments.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Net (after fee)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fraud Score</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p: Record<string, unknown>) => (
                <TableRow key={p.id as string}>
                  <TableCell className="font-medium">{formatCurrency(p.amount as number)}</TableCell>
                  <TableCell>{formatCurrency(p.netAmount as number)}</TableCell>
                  <TableCell><Badge variant={statusColor[p.status as string] ?? 'secondary'}>{p.status as string}</Badge></TableCell>
                  <TableCell>
                    {p.fraudScore != null
                      ? <Badge variant={(p.fraudScore as number) > 70 ? 'destructive' : 'secondary'}>{p.fraudScore as number}/100</Badge>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.createdAt as string)}</TableCell>
                  <TableCell>
                    {p.status === 'IN_ESCROW' && (
                      <Button size="sm" onClick={() => releaseMutation.mutate(p.id as string)}>Release</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No payments yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

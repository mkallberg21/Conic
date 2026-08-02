'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ShieldCheck, Lock, CheckCircle2, Undo2 } from 'lucide-react';

type EscrowStatus = 'PENDING_FUNDING' | 'FUNDED' | 'RELEASED' | 'REFUNDED';
interface EscrowState {
  escrow: { id: string; amountCents: number; currency: string; status: EscrowStatus } | null;
  fundable: boolean;
}

const money = (c: number, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(c / 100);

const badge: Record<EscrowStatus, { label: string; cls: string }> = {
  PENDING_FUNDING: { label: 'Not funded', cls: 'bg-slate-400' },
  FUNDED: { label: 'Funds held in escrow', cls: 'bg-emerald-600' },
  RELEASED: { label: 'Released to creator', cls: 'bg-blue-600' },
  REFUNDED: { label: 'Refunded to brand', cls: 'bg-amber-500' },
};

export function EscrowPanel({ contractId, isBrand }: { contractId: string; isBrand: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<EscrowState>({
    queryKey: ['escrow', contractId],
    queryFn: () => api.get(`/v1/escrow/contract/${contractId}`).then((r) => r.data.data),
  });

  const onErr = (e: unknown) =>
    toast({ title: 'Error', description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed', variant: 'destructive' });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['escrow', contractId] });

  const fund = useMutation({
    mutationFn: () => api.post(`/v1/escrow/contract/${contractId}/fund`),
    onSuccess: () => { toast({ title: 'Escrow funded' }); invalidate(); }, onError: onErr,
  });
  const release = useMutation({
    mutationFn: () => api.post(`/v1/escrow/contract/${contractId}/release`),
    onSuccess: () => { toast({ title: 'Funds released to creator' }); invalidate(); }, onError: onErr,
  });
  const refund = useMutation({
    mutationFn: () => api.post(`/v1/escrow/contract/${contractId}/refund`),
    onSuccess: () => { toast({ title: 'Funds refunded' }); invalidate(); }, onError: onErr,
  });

  if (isLoading) return null;

  const status = data?.escrow?.status ?? 'PENDING_FUNDING';
  const b = badge[status];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Escrow</span>
          <Badge className={b.cls}>{b.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {status === 'FUNDED'
            ? 'The brand’s payment is held safely until the work is approved.'
            : status === 'RELEASED'
              ? 'The held funds have been paid out to the creator.'
              : status === 'REFUNDED'
                ? 'The held funds were returned to the brand.'
                : 'Funds aren’t held yet. The brand can fund escrow so the creator knows they’ll be paid.'}
        </p>
        {data?.escrow && (
          <p className="text-2xl font-bold tabular-nums">{money(data.escrow.amountCents, data.escrow.currency)}</p>
        )}

        {isBrand && (
          <div className="flex flex-wrap gap-2">
            {status === 'PENDING_FUNDING' && (
              <Button disabled={!data?.fundable || fund.isPending} onClick={() => fund.mutate()}>
                <Lock className="mr-1 h-4 w-4" /> Fund escrow
              </Button>
            )}
            {status === 'FUNDED' && (
              <>
                <Button disabled={release.isPending} onClick={() => release.mutate()}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Release to creator
                </Button>
                <Button variant="outline" disabled={refund.isPending} onClick={() => refund.mutate()}>
                  <Undo2 className="mr-1 h-4 w-4" /> Refund
                </Button>
              </>
            )}
          </div>
        )}
        {!isBrand && status === 'FUNDED' && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700"><ShieldCheck className="h-4 w-4" /> You’re protected — the money is already set aside.</p>
        )}
      </CardContent>
    </Card>
  );
}

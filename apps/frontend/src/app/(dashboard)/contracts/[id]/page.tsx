'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft, FileText, CheckCircle, AlertTriangle, Clock, DollarSign, User, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { EscrowPanel } from '@/components/escrow-panel';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_SIGNATURE: 'outline',
  ACTIVE: 'default',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
  DISPUTED: 'destructive',
};

const actionLabel: Record<string, string> = {
  CONTRACT_CREATED: 'Contract created',
  CONTRACT_SIGNED: 'Contract signed',
  CONTRACT_ACTIVATED: 'Contract activated',
  CONTRACT_CANCELLED: 'Contract cancelled',
  CONTRACT_DISPUTED: 'Dispute opened',
  DELIVERABLE_CREATED: 'Deliverable added',
  DELIVERABLE_SUBMITTED: 'Deliverable submitted',
  DELIVERABLE_APPROVED: 'Deliverable approved',
  DELIVERABLE_REJECTED: 'Deliverable rejected',
  DELIVERABLE_REVISION_REQUESTED: 'Revision requested',
  PAYMENT_CREATED: 'Payment created',
  PAYMENT_RELEASED: 'Payment released',
  PAYMENT_FAILED: 'Payment failed',
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get(`/v1/contracts/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ['contract-activity', id],
    queryFn: () => api.get(`/v1/contracts/${id}/activity`).then((r) => r.data),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const signMutation = useMutation({
    mutationFn: () => api.post(`/v1/contracts/${id}/sign`),
    onSuccess: () => {
      toast({ title: 'Contract signed', description: 'Your signature has been recorded.' });
      void qc.invalidateQueries({ queryKey: ['contract', id] });
      void qc.invalidateQueries({ queryKey: ['contract-activity', id] });
    },
    onError: () => toast({ title: 'Failed to sign', variant: 'destructive' }),
  });

  const disputeMutation = useMutation({
    mutationFn: () => api.post(`/v1/contracts/${id}/dispute`, { reason: disputeReason }),
    onSuccess: () => {
      toast({ title: 'Dispute opened', description: 'Both parties have been notified.' });
      setDisputeOpen(false);
      void qc.invalidateQueries({ queryKey: ['contract', id] });
      void qc.invalidateQueries({ queryKey: ['contract-activity', id] });
    },
    onError: () => toast({ title: 'Failed to open dispute', variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!contract) {
    return <div className="p-6 text-muted-foreground">Contract not found.</div>;
  }

  const isBrand = user?.role === 'BRAND';
  const isCreator = user?.role === 'CREATOR';
  const hasSignedAsBrand = !!contract.brandSignedAt;
  const hasSignedAsCreator = !!contract.creatorSignedAt;
  const canSign =
    (isBrand && !hasSignedAsBrand && ['DRAFT', 'PENDING_SIGNATURE'].includes(contract.status)) ||
    (isCreator && !hasSignedAsCreator && ['DRAFT', 'PENDING_SIGNATURE'].includes(contract.status));
  const canDispute = contract.status === 'ACTIVE';

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{contract.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {contract.brand?.user?.firstName} {contract.brand?.user?.lastName}
            {' '}&rarr;{' '}
            {contract.creator?.user?.firstName} {contract.creator?.user?.lastName}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusColor[contract.status] ?? 'secondary'}>{contract.status}</Badge>
          {/* Escrow panel is rendered below the header */}
          {canSign && (
            <Button onClick={() => signMutation.mutate()} disabled={signMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" />
              {signMutation.isPending ? 'Signing…' : 'Sign Contract'}
            </Button>
          )}
          {canDispute && (
            <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <AlertTriangle className="h-4 w-4 mr-1" /> Open Dispute
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Open a Dispute</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground mb-2">
                  Describe the issue. Both parties will be notified and the contract will be paused.
                </p>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Describe the dispute reason…"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                />
                <Button
                  variant="destructive"
                  disabled={!disputeReason.trim() || disputeMutation.isPending}
                  onClick={() => disputeMutation.mutate()}
                  className="w-full mt-2"
                >
                  {disputeMutation.isPending ? 'Submitting…' : 'Submit Dispute'}
                </Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Escrow */}
      <EscrowPanel contractId={id} isBrand={isBrand} />

      {/* Signatures */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" /> Signatures
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            {hasSignedAsBrand
              ? <CheckCircle className="h-4 w-4 text-green-500" />
              : <Clock className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">Brand</p>
              <p className="text-xs text-muted-foreground">
                {hasSignedAsBrand
                  ? format(new Date(contract.brandSignedAt), 'MMM d, yyyy HH:mm')
                  : 'Awaiting signature'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasSignedAsCreator
              ? <CheckCircle className="h-4 w-4 text-green-500" />
              : <Clock className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">Creator</p>
              <p className="text-xs text-muted-foreground">
                {hasSignedAsCreator
                  ? format(new Date(contract.creatorSignedAt), 'MMM d, yyyy HH:mm')
                  : 'Awaiting signature'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract value */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Value &amp; Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Value</p>
            <p className="font-semibold">{formatCurrency(contract.totalValue, contract.currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Start Date</p>
            <p className="font-semibold">{contract.startDate ? format(new Date(contract.startDate), 'MMM d, yyyy') : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">End Date</p>
            <p className="font-semibold">{contract.endDate ? format(new Date(contract.endDate), 'MMM d, yyyy') : '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Deliverables */}
      {contract.deliverables?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Deliverables ({contract.deliverables.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.deliverables.map((d: {
                  id: string; title: string; platform?: string;
                  dueDate?: string; status: string;
                }) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell className="text-muted-foreground">{d.platform ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.dueDate ? format(new Date(d.dueDate), 'MMM d') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor[d.status] ?? 'secondary'} className="text-xs">
                        {d.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      {contract.payments?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Payments ({contract.payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.payments.map((p: {
                  id: string; description?: string; amount: number;
                  currency: string; status: string; paidAt?: string;
                }) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{p.description ?? '—'}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(p.amount, p.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'COMPLETED' ? 'default' : p.status === 'FAILED' ? 'destructive' : 'secondary'} className="text-xs">
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.paidAt ? format(new Date(p.paidAt), 'MMM d, yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" /> Activity Feed
            <span className="text-xs text-muted-foreground font-normal ml-auto">Shared — visible to all parties</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
          ) : (
            <ol className="relative border-l border-muted ml-3 space-y-4">
              {activity.map((entry: {
                id: string; action: string; createdAt: string; resourceLabel?: string;
                user?: { firstName?: string; lastName?: string; role?: string };
                newValue?: unknown;
              }) => (
                <li key={entry.id} className="pl-5 relative">
                  <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-primary/30 ring-2 ring-background" />
                  <p className="text-sm font-medium leading-tight">
                    {actionLabel[entry.action] ?? entry.action}
                    {entry.resourceLabel && entry.resourceLabel !== 'Contract' && (
                      <span className="text-muted-foreground font-normal"> · {entry.resourceLabel}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {entry.user ? `${entry.user.firstName} ${entry.user.lastName} (${entry.user.role})` : 'System'}
                    {' · '}
                    {format(new Date(entry.createdAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

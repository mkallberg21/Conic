'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  SUBMITTED: 'outline',
  UNDER_REVIEW: 'outline',
  APPROVED: 'default',
  REJECTED: 'destructive',
  REVISION_REQUESTED: 'outline',
};

export default function DeliverablesPage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['deliverables'],
    queryFn: () => api.get('/v1/deliverables').then((r) => r.data.data),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/v1/deliverables/${id}/review`, { status }),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['deliverables'] });
      toast({ title: `Deliverable ${status.toLowerCase()}` });
    },
    onError: () => toast({ title: 'Error', description: 'Action failed', variant: 'destructive' }),
  });

  const deliverables = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deliverables</h1>
        <p className="text-muted-foreground">Track and review creator deliverables</p>
      </div>

      <Card>
        <CardHeader><CardTitle>All Deliverables ({deliverables.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliverables.map((d: Record<string, unknown>) => (
                <TableRow key={d.id as string}>
                  <TableCell className="font-medium">{d.title as string}</TableCell>
                  <TableCell className="capitalize">{d.platform as string}</TableCell>
                  <TableCell><Badge variant={statusColor[d.status as string] ?? 'secondary'}>{d.status as string}</Badge></TableCell>
                  <TableCell>
                    {d.verificationScore != null
                      ? <Badge variant={(d.verificationScore as number) >= 70 ? 'default' : 'destructive'}>{d.verificationScore as number}/100</Badge>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.dueDate ? formatDate(d.dueDate as string) : '—'}</TableCell>
                  <TableCell className="flex gap-2">
                    {d.status === 'SUBMITTED' || d.status === 'UNDER_REVIEW' ? (
                      <>
                        <Button size="sm" onClick={() => reviewMutation.mutate({ id: d.id as string, status: 'APPROVED' })}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate({ id: d.id as string, status: 'REJECTED' })}>Reject</Button>
                      </>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {deliverables.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No deliverables yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

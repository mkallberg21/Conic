'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NilDisclosure {
  id: string;
  dealType: string;
  brandName: string;
  dealValueCents: number;
  status: string;
  startDate: string;
  endDate?: string;
  aiGeneratedSummary?: string;
  createdAt: string;
  athlete?: { user: { name: string } };
}

interface NilDeal {
  id: string;
  title: string;
  dealValueCents: number;
  status: string;
  startDate: string;
  endDate?: string;
  brand?: { name: string };
  athlete?: { user: { name: string } };
}

interface StatsData {
  totalDisclosures: number;
  pendingDisclosures: number;
  approvedDisclosures: number;
  rejectedDisclosures: number;
  activeDeals: number;
  totalNilValueCents: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDollars = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100,
  );

const statusColor = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'active':
      return 'default';
    case 'pending_review':
    case 'pending':
      return 'secondary';
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
};

// ─── Review Dialog ────────────────────────────────────────────────────────────

function ReviewDialog({ disclosureId, onSuccess }: { disclosureId: string; onSuccess: () => void }) {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/v1/nil/disclosures/review', { disclosureId, decision, reviewNotes: notes }),
    onSuccess,
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={decision === 'APPROVED' ? 'default' : 'outline'}
          onClick={() => setDecision('APPROVED')}
          className="w-full"
        >
          Approve
        </Button>
        <Button
          variant={decision === 'REJECTED' ? 'destructive' : 'outline'}
          onClick={() => setDecision('REJECTED')}
          className="w-full"
        >
          Reject
        </Button>
      </div>
      <Input
        placeholder="Review notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button
        className="w-full"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Submitting…' : 'Submit Review'}
      </Button>
      {mutation.isError && (
        <p className="text-sm text-destructive">Failed to submit review. Please try again.</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NilCompliancePage() {
  const queryClient = useQueryClient();
  const [selectedDisclosureId, setSelectedDisclosureId] = useState<string | null>(null);
  const [disclosurePage, setDisclosurePage] = useState(1);
  const [dealPage, setDealPage] = useState(1);

  const { data: stats } = useQuery<StatsData>({
    queryKey: ['nil', 'stats'],
    queryFn: () => api.get('/v1/nil/disclosures?page=1&take=1').then(() => ({
      totalDisclosures: 0,
      pendingDisclosures: 0,
      approvedDisclosures: 0,
      rejectedDisclosures: 0,
      activeDeals: 0,
      totalNilValueCents: 0,
    })),
  });

  const { data: disclosuresData, isLoading: loadingDisclosures } = useQuery({
    queryKey: ['nil', 'disclosures', disclosurePage],
    queryFn: () =>
      api.get(`/v1/nil/disclosures?page=${disclosurePage}&take=15`).then((r) => r.data),
  });

  const { data: dealsData, isLoading: loadingDeals } = useQuery({
    queryKey: ['nil', 'deals', dealPage],
    queryFn: () =>
      api.get(`/v1/nil/deals?page=${dealPage}&take=15`).then((r) => r.data),
  });

  const disclosures: NilDisclosure[] = disclosuresData?.data ?? [];
  const deals: NilDeal[] = dealsData?.data ?? [];

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['nil'] });
    setSelectedDisclosureId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">NIL Compliance</h1>
        <p className="text-muted-foreground">
          Review athlete disclosures, monitor NIL deals, and manage compliance reporting
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Disclosures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.pendingDisclosures ?? '—'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active NIL Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.activeDeals ?? '—'}</div>
            <p className="text-sm text-muted-foreground mt-1">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total NIL Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.totalNilValueCents != null
                ? formatDollars(stats.totalNilValueCents)
                : '—'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">This period</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="disclosures">
        <TabsList>
          <TabsTrigger value="disclosures">Disclosures</TabsTrigger>
          <TabsTrigger value="deals">NIL Deals</TabsTrigger>
        </TabsList>

        {/* Disclosures Tab */}
        <TabsContent value="disclosures" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Athlete Disclosures</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDisclosures ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Athlete</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disclosures.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No disclosures found
                          </TableCell>
                        </TableRow>
                      ) : (
                        disclosures.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium">
                              {d.athlete?.user.name ?? '—'}
                            </TableCell>
                            <TableCell>{d.brandName}</TableCell>
                            <TableCell className="capitalize">
                              {d.dealType.replace(/_/g, ' ')}
                            </TableCell>
                            <TableCell>{formatDollars(d.dealValueCents)}</TableCell>
                            <TableCell>
                              <Badge variant={statusColor(d.status)}>
                                {d.status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(d.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {d.status === 'PENDING_REVIEW' && (
                                <Dialog
                                  open={selectedDisclosureId === d.id}
                                  onOpenChange={(open) =>
                                    setSelectedDisclosureId(open ? d.id : null)
                                  }
                                >
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="outline">
                                      Review
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Review Disclosure</DialogTitle>
                                    </DialogHeader>
                                    {d.aiGeneratedSummary && (
                                      <p className="text-sm text-muted-foreground bg-muted rounded-md p-3">
                                        <span className="font-semibold text-foreground">
                                          AI Analysis:{' '}
                                        </span>
                                        {d.aiGeneratedSummary}
                                      </p>
                                    )}
                                    <ReviewDialog
                                      disclosureId={d.id}
                                      onSuccess={refreshAll}
                                    />
                                  </DialogContent>
                                </Dialog>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-end gap-2 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disclosurePage === 1}
                      onClick={() => setDisclosurePage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {disclosurePage}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disclosures.length < 15}
                      onClick={() => setDisclosurePage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NIL Deals Tab */}
        <TabsContent value="deals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>NIL Deals</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDeals ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Athlete</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No NIL deals found
                          </TableCell>
                        </TableRow>
                      ) : (
                        deals.map((deal) => (
                          <TableRow key={deal.id}>
                            <TableCell className="font-medium">
                              {deal.athlete?.user.name ?? '—'}
                            </TableCell>
                            <TableCell>{deal.brand?.name ?? '—'}</TableCell>
                            <TableCell>{deal.title}</TableCell>
                            <TableCell>{formatDollars(deal.dealValueCents)}</TableCell>
                            <TableCell>
                              <Badge variant={statusColor(deal.status)}>
                                {deal.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(deal.startDate).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-end gap-2 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={dealPage === 1}
                      onClick={() => setDealPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {dealPage}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deals.length < 15}
                      onClick={() => setDealPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AthleteProfile {
  id: string;
  sport: string;
  eligibilityStatus: string;
  nilEarnedYtdCents: number;
  nilCapCents?: number;
  user: { name: string; email: string };
  university?: { name: string };
}

interface GuardianApproval {
  id: string;
  resourceType: string;
  resourceId: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  athlete?: { user: { name: string } };
}

interface NilDisclosure {
  id: string;
  dealType: string;
  brandName: string;
  dealValueCents: number;
  status: string;
  createdAt: string;
}

interface NilDeal {
  id: string;
  title: string;
  dealValueCents: number;
  status: string;
  startDate: string;
  brand?: { name: string };
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
    case 'eligible':
      return 'default';
    case 'pending_review':
    case 'pending':
    case 'at_risk':
      return 'secondary';
    case 'rejected':
    case 'ineligible':
      return 'destructive';
    default:
      return 'outline';
  }
};

const capProgress = (earned: number, cap?: number) => {
  if (!cap || cap === 0) return null;
  const pct = Math.min(100, Math.round((earned / cap) * 100));
  return pct;
};

// ─── Submit Disclosure Form ───────────────────────────────────────────────────

function SubmitDisclosureForm({ athleteId, onSuccess }: { athleteId: string; onSuccess: () => void }) {
  const [form, setForm] = useState({
    dealType: 'endorsement',
    brandName: '',
    dealValueCents: '',
    startDate: '',
    universityId: '',
    platforms: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/v1/nil/disclosures', {
        athleteId,
        dealType: form.dealType,
        brandName: form.brandName,
        dealValueCents: Math.round(parseFloat(form.dealValueCents) * 100),
        startDate: form.startDate,
        universityId: form.universityId || undefined,
        platforms: form.platforms.split(',').map((p) => p.trim()).filter(Boolean),
      }),
    onSuccess,
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Deal Type</label>
          <select
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.dealType}
            onChange={(e) => setForm({ ...form, dealType: e.target.value })}
          >
            <option value="endorsement">Endorsement</option>
            <option value="appearance">Appearance</option>
            <option value="social_post">Social Post</option>
            <option value="licensing">Licensing</option>
            <option value="camp_clinic">Camp / Clinic</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Brand Name</label>
          <Input
            className="mt-1"
            placeholder="Brand or company name"
            value={form.brandName}
            onChange={(e) => setForm({ ...form, brandName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Deal Value ($)</label>
          <Input
            className="mt-1"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.dealValueCents}
            onChange={(e) => setForm({ ...form, dealValueCents: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Start Date</label>
          <Input
            className="mt-1"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Platforms (comma-separated)</label>
        <Input
          className="mt-1"
          placeholder="instagram, tiktok, twitter"
          value={form.platforms}
          onChange={(e) => setForm({ ...form, platforms: e.target.value })}
        />
      </div>
      <Button
        className="w-full"
        disabled={mutation.isPending || !form.brandName || !form.dealValueCents || !form.startDate}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Submitting…' : 'Submit Disclosure'}
      </Button>
      {mutation.isError && (
        <p className="text-sm text-destructive">Failed to submit. Please try again.</p>
      )}
      {mutation.isSuccess && (
        <p className="text-sm text-green-600">Disclosure submitted for review.</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AthleteNilPage() {
  const queryClient = useQueryClient();
  const [showDisclosureForm, setShowDisclosureForm] = useState(false);

  const { data: profile, isLoading: loadingProfile } = useQuery<AthleteProfile>({
    queryKey: ['athlete', 'me'],
    queryFn: () => api.get('/v1/users/me').then((r) => r.data.data),
  });

  const { data: disclosuresData, isLoading: loadingDisclosures } = useQuery({
    queryKey: ['nil', 'disclosures', 'mine'],
    queryFn: () => api.get('/v1/nil/disclosures?page=1&take=20').then((r) => r.data),
  });

  const { data: dealsData, isLoading: loadingDeals } = useQuery({
    queryKey: ['nil', 'deals', 'mine'],
    queryFn: () => api.get('/v1/nil/deals?page=1&take=20').then((r) => r.data),
  });

  const { data: approvals } = useQuery<GuardianApproval[]>({
    queryKey: ['guardian', 'approvals'],
    queryFn: () => api.get('/v1/guardian/approvals/pending').then((r) => r.data.data ?? []),
  });

  const disclosures: NilDisclosure[] = disclosuresData?.data ?? [];
  const deals: NilDeal[] = dealsData?.data ?? [];
  const pendingApprovals = approvals ?? [];

  const capPct = profile
    ? capProgress(profile.nilEarnedYtdCents, profile.nilCapCents ?? undefined)
    : null;

  if (loadingProfile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">NIL Hub</h1>
          <p className="text-muted-foreground">
            Manage your Name, Image, and Likeness deals and disclosures
          </p>
        </div>
        <Button onClick={() => setShowDisclosureForm(!showDisclosureForm)}>
          {showDisclosureForm ? 'Cancel' : '+ New Disclosure'}
        </Button>
      </div>

      {/* Submit Form */}
      {showDisclosureForm && profile && (
        <Card>
          <CardHeader>
            <CardTitle>Submit NIL Disclosure</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmitDisclosureForm
              athleteId={profile.id}
              onSuccess={() => {
                setShowDisclosureForm(false);
                queryClient.invalidateQueries({ queryKey: ['nil'] });
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Guardian Approvals Notice */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {pendingApprovals.length} deal{pendingApprovals.length > 1 ? 's' : ''} waiting for{' '}
            guardian approval
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sport</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold capitalize">{profile?.sport ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Eligibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={statusColor(profile?.eligibilityStatus ?? '')}>
              {profile?.eligibilityStatus?.replace(/_/g, ' ') ?? '—'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Earned YTD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {profile ? formatDollars(profile.nilEarnedYtdCents) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              NIL Cap
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile?.nilCapCents ? (
              <>
                <div className="text-xl font-bold">{formatDollars(profile.nilCapCents)}</div>
                {capPct !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Used</span>
                      <span>{capPct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          capPct > 80 ? 'bg-destructive' : capPct > 60 ? 'bg-amber-500' : 'bg-primary'
                        }`}
                        style={{ width: `${capPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground text-sm">No cap set</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="disclosures">
        <TabsList>
          <TabsTrigger value="disclosures">
            My Disclosures{' '}
            {disclosures.filter((d) => d.status === 'PENDING_REVIEW').length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {disclosures.filter((d) => d.status === 'PENDING_REVIEW').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deals">My Deals</TabsTrigger>
        </TabsList>

        <TabsContent value="disclosures" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loadingDisclosures ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disclosures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No disclosures yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      disclosures.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.brandName}</TableCell>
                          <TableCell className="capitalize">{d.dealType.replace(/_/g, ' ')}</TableCell>
                          <TableCell>{formatDollars(d.dealValueCents)}</TableCell>
                          <TableCell>
                            <Badge variant={statusColor(d.status)}>
                              {d.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(d.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loadingDeals ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No deals yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      deals.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.title}</TableCell>
                          <TableCell>{d.brand?.name ?? '—'}</TableCell>
                          <TableCell>{formatDollars(d.dealValueCents)}</TableCell>
                          <TableCell>
                            <Badge variant={statusColor(d.status)}>{d.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(d.startDate).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

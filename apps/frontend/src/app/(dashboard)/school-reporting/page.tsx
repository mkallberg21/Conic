'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  activeAthletes: number;
  pendingDisclosures: number;
  activeDeals: number;
  totalEarningsYtdCents: number;
}

interface ComplianceReport {
  id: string;
  periodType: string;
  periodLabel: string;
  status: string;
  totalDisclosures: number;
  approvedDisclosures: number;
  totalNilValueCents: number;
  createdAt: string;
  executiveSummary?: string;
}

interface Athlete {
  id: string;
  sport: string;
  eligibilityStatus: string;
  nilEarnedYtdCents: number;
  user: { name: string; email: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDollars = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100,
  );

const statusBadge = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'active':
    case 'eligible':
    case 'published':
      return 'default';
    case 'pending_review':
    case 'pending':
    case 'draft':
    case 'at_risk':
      return 'secondary';
    case 'rejected':
    case 'ineligible':
      return 'destructive';
    default:
      return 'outline';
  }
};

// ─── Generate Report Form ────────────────────────────────────────────────────

function GenerateReportPanel({ universityId, onSuccess }: { universityId: string; onSuccess: () => void }) {
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'annual'>('quarterly');
  const [periodLabel, setPeriodLabel] = useState('');
  const [audienceType, setAudienceType] = useState('compliance_officer');

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/v1/nil/reports', {
        universityId,
        periodType,
        periodLabel: periodLabel || undefined,
        audienceType,
      }),
    onSuccess,
  });

  const currentQuarter = () => {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    return `${now.getFullYear()}-Q${q}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Period Type</label>
          <select
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as 'monthly' | 'quarterly' | 'annual')}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">
            Period Label{' '}
            <span className="text-muted-foreground text-xs">
              (e.g. {periodType === 'monthly' ? '2024-03' : periodType === 'quarterly' ? currentQuarter() : '2024'})
            </span>
          </label>
          <input
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={
              periodType === 'monthly'
                ? '2024-03'
                : periodType === 'quarterly'
                ? currentQuarter()
                : '2024'
            }
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Audience</label>
          <select
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={audienceType}
            onChange={(e) => setAudienceType(e.target.value)}
          >
            <option value="compliance_officer">Compliance Officer</option>
            <option value="athletic_director">Athletic Director</option>
            <option value="ncaa_submission">NCAA Submission</option>
          </select>
        </div>
      </div>
      <Button
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className="w-full sm:w-auto"
      >
        {mutation.isPending ? 'Generating…' : 'Generate AI Report'}
      </Button>
      {mutation.isError && (
        <p className="text-sm text-destructive">Report generation failed. Please try again.</p>
      )}
      {mutation.isSuccess && (
        <p className="text-sm text-green-600">Report generated successfully.</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchoolReportingPage() {
  // In a real impl we'd get this from auth context / user's university linkage
  const universityId = 'me';

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['university', 'stats', universityId],
    queryFn: () =>
      api.get(`/v1/universities/${universityId}/dashboard`).then((r) => r.data.data),
  });

  const { data: reportsData, isLoading: loadingReports, refetch: refetchReports } = useQuery({
    queryKey: ['nil', 'reports'],
    queryFn: () => api.get('/v1/nil/reports?page=1&take=10').then((r) => r.data),
  });

  const { data: rosterData, isLoading: loadingRoster } = useQuery({
    queryKey: ['university', 'roster', universityId],
    queryFn: () =>
      api.get(`/v1/universities/${universityId}/athletes?page=1&take=50`).then((r) => r.data),
  });

  const reports: ComplianceReport[] = reportsData?.data ?? [];
  const athletes: Athlete[] = rosterData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">School Reporting</h1>
        <p className="text-muted-foreground">
          AI-generated NIL compliance reports for your institution
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Athletes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.activeAthletes ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Disclosures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {stats?.pendingDisclosures ?? '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.activeDeals ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total NIL Earnings YTD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.totalEarningsYtdCents != null
                ? formatDollars(stats.totalEarningsYtdCents)
                : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">Generate Report</TabsTrigger>
          <TabsTrigger value="reports">Report History</TabsTrigger>
          <TabsTrigger value="roster">Athlete Roster</TabsTrigger>
        </TabsList>

        {/* Generate Report */}
        <TabsContent value="generate" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate AI Compliance Report</CardTitle>
            </CardHeader>
            <CardContent>
              <GenerateReportPanel
                universityId={universityId}
                onSuccess={() => refetchReports()}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report History */}
        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Report History</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No reports generated yet</p>
                  ) : (
                    reports.map((report) => (
                      <div
                        key={report.id}
                        className="rounded-lg border bg-card p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold capitalize">
                              {report.periodType} — {report.periodLabel}
                            </span>
                            <Badge variant={statusBadge(report.status)} className="ml-2">
                              {report.status}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Disclosures: </span>
                            <span className="font-medium">
                              {report.approvedDisclosures}/{report.totalDisclosures} approved
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total NIL Value: </span>
                            <span className="font-medium">
                              {formatDollars(report.totalNilValueCents)}
                            </span>
                          </div>
                        </div>
                        {report.executiveSummary && (
                          <p className="text-sm text-muted-foreground bg-muted rounded p-3">
                            {report.executiveSummary}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Athlete Roster */}
        <TabsContent value="roster" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Athlete NIL Roster</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRoster ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Sport</TableHead>
                      <TableHead>Eligibility</TableHead>
                      <TableHead>Earned YTD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {athletes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No athletes found
                        </TableCell>
                      </TableRow>
                    ) : (
                      athletes.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.user.name}</TableCell>
                          <TableCell className="capitalize">{a.sport}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadge(a.eligibilityStatus)}>
                              {a.eligibilityStatus.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDollars(a.nilEarnedYtdCents)}</TableCell>
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

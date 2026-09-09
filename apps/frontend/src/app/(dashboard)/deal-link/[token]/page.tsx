'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle, CheckCircle2, Link2, Clock, ShieldCheck,
  ArrowRight, Copy, Check,
} from 'lucide-react';
import { publicApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────────

interface DealLinkStatus {
  dealLinkId: string;
  disclosureId: string;
  status: string;
  submittedAt: string;
  contributorType: string;
  contributorLabel: string;
  contributions: Array<{
    id: string;
    contributorType: string;
    contributorLabel: string;
    submittedAt: string;
    hasNotes: boolean;
  }>;
  remainingContributions: number;
  expiresAt: string;
  acceptedAt: string;
}

interface ContributionResponse {
  id: string;
  dealType: string;
  brandName: string;
  dealValueCents: number;
  status: string;
  startDate: string;
  endDate?: string;
  description?: string;
  platforms: string[];
  aiGeneratedSummary?: string;
  aiComplianceFlags?: unknown;
  aiStateRules?: unknown;
  aiNcaaRules?: unknown;
  riskLevel?: string;
  athlete?: {
    user: { firstName: string; lastName: string };
    university?: { name: string; state: string };
  };
  dealLink?: {
    contributions: Array<{
      id: string;
      contributorType: string;
      contributorLabel: string;
      submittedAt: string;
    }>;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────────

const formatDollars = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);

const daysUntil = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
};

const DealTypeOptions = [
  { value: 'endorsement', label: 'Endorsement' },
  { value: 'appearance', label: 'Appearance / Event' },
  { value: 'social_post', label: 'Social Post' },
  { value: 'licensing', label: 'Licensing' },
  { value: 'camp_clinic', label: 'Camp / Clinic' },
  { value: 'other', label: 'Other' },
];

const PlatformOptions = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitch', label: 'Twitch' },
];

// ─── Component ───────────────────────────────────────────────────────────────────

export default function DealLinkContributePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const rawToken = searchParams.token;
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<DealLinkStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contributed, setContributed] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    dealType: 'endorsement',
    brandName: '',
    dealValueCents: 0,
    startDate: '',
    endDate: '',
    description: '',
    platforms: [] as string[],
    contributorNotes: '',
  });

  // ── Load existing link state on mount ──────────────────────────────────────────
  useState(() => {
    if (!rawToken) return;
    const timer = setTimeout(async () => {
      try {
        const res = await publicApi.get(`/v1/deal-link/${rawToken}`);
        setStatus(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message ?? `Link not found: ${rawToken}`);
      }
    }, 200);
    return () => clearTimeout(timer);
  });

  // ── Mutation: submit contribution ───────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (dto: typeof form) => {
      return publicApi.post(`/v1/deal-link/${rawToken}/contribute`, dto);
    },
    onSuccess: (data: ContributionResponse) => {
      setContributed(true);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              status: data.status,
              remainingContributions: Math.max(0, prev.remainingContributions - 1),
            }
          : null,
      );
    },
    onError: (err: any) => {
      setError(err.response?.data?.message ?? 'Failed to submit contribution');
    },
  });

  if (!rawToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-muted-foreground">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h1 className="text-xl font-semibold text-foreground">Missing DealLink token</h1>
        <p>This page requires a DealLink token in the URL (e.g. <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/deal-link/dl_xyz...</code>).</p>
        <p className="text-sm">The link was shared with you by the athlete or their representative.</p>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-muted-foreground">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h1 className="text-xl font-semibold text-foreground">Link Error</h1>
        <p className="text-sm max-w-md">{error}</p>
        <Button variant="outline" asChild>
          <a href="/">Return home</a>
        </Button>
      </div>
    );
  }

  const isNearExpiry = status && new Date(status.expiresAt).getTime() - Date.now() < 86400000; // < 24h
  const isOneLeft = status && status.remainingContributions === 1;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Link status banner ──────────────────────────────────────────────────────── */}
      {status && (
        <Card className="bg-muted/50 border-muted/50">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardDescription className="text-sm">
                  <Link2 className="inline h-3.5 w-3.5 text-muted-foreground mr-1" />
                  DealLink — {status.contributorType}
                  {status.contributorLabel ? ` (${status.contributorLabel})` : ''}
                </CardDescription>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {formatDollars(
                      status.status === 'PENDING_REVIEW' ? 0 : 0 // placeholder; real value from disclosure
                    )}
                  </Badge>
                  <span>
                    {status.remainingContributions} of {status.remainingContributions + (status.remainingContributions > 0 ? 0 : 0)} contributions remaining
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {daysUntil(status.expiresAt)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                {isNearExpiry && (
                  <Badge variant="destructive" className="text-xs">Expiring soon</Badge>
                )}
                {isOneLeft && (
                  <Badge variant="secondary" className="text-xs">Last contribution</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                Your contribution will be added to the disclosure. If the athlete is a minor, their guardian will be
                asked to approve. A compliance officer will review the disclosure.
              </p>
              {status.contributions.length > 0 && (
                <p className="pt-1">
                  <strong>{status.contributions.length} contribution(s)</strong> already submitted:
                  {status.contributions.map((c) => (
                    <span key={c.id} className="text-accent">
                      {' '}{c.contributorType}{c.contributorLabel ? ` (${c.contributorLabel})` : ''}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Contribution form ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submit your contribution</CardTitle>
          <CardDescription>
            Fill in the deal details. You don&apos;t need an account — the DealLink token in the URL is all that identifies you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!contributed ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLoading(true);
                mutation.mutate(form, {
                  onSuccess: () => setLoading(false),
                  onError: () => setLoading(false),
                });
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="dealType">Deal Type</Label>
                  <select
                    id="dealType"
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.dealType}
                    onChange={(e) => setForm({ ...form, dealType: e.target.value })}
                  >
                    {DealTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="brandName">Brand / Business Name</Label>
                  <Input
                    id="brandName"
                    placeholder="e.g. Nike Sportswear"
                    value={form.brandName}
                    onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                    required
                    minLength={2}
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="dealValueCents">Deal Value (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="dealValueCents"
                      type="number"
                      min={0}
                      step={100}
                      placeholder="0"
                      className="pl-7"
                      value={form.dealValueCents}
                      onChange={(e) => setForm({ ...form, dealValueCents: parseInt(e.target.value, 10) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date (optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="e.g. 3 Instagram posts + 1 story series over 4 weeks"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={2000}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {PlatformOptions.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        const next = form.platforms.includes(o.value)
                          ? form.platforms.filter((p) => p !== o.value)
                          : [...form.platforms, o.value];
                        setForm({ ...form, platforms: next });
                      }}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        form.platforms.includes(o.value)
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-muted/50 hover:border-accent/50 text-muted-foreground'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contributorNotes">Your Notes (optional)</Label>
                <Textarea
                  id="contributorNotes"
                  placeholder="e.g. Posted rate based on 3-post package. Contact: jane@brand.com"
                  value={form.contributorNotes}
                  onChange={(e) => setForm({ ...form, contributorNotes: e.target.value })}
                  maxLength={2000}
                  rows={2}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href).then(() => setCopied(true));
                    }
                  }}
                >
                  {copied ? <><Check className="h-3.5 w-3.5 mr-1" />Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" />Copy link</>}
                </Button>
                <Button type="submit" disabled={loading || mutation.isPending}>
                  {loading || mutation.isPending ? 'Submitting...' : <>Submit Contribution <ArrowRight className="h-3.5 w-3.5 ml-1" /></>}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Contribution submitted
                </div>
                <p className="text-sm text-foreground mt-1">
                  Your deal details have been added to the disclosure. The AI compliance analysis will re-run on the
                  updated information, and the disclosure will appear in the compliance officer&apos;s review queue.
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href={`/deal-link/${rawToken}`}>Review what was submitted</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── What happens next ───────────────────────────────────────────────────────── */}
      <Card className="bg-accent/5 border-accent/10">
        <CardHeader>
          <CardTitle className="text-base">What happens next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-1">
            <li>Your contribution is merged into the disclosure and the AI compliance analysis re-runs.</li>
            <li>The disclosure status moves to <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">PENDING_REVIEW</code>.</li>
            <li>If the athlete is a minor, their guardian receives an approval request.</li>
            <li>A compliance officer reviews the disclosure and approves or rejects it.</li>
            <li>Once approved, the deal can move forward to contract generation and payment.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
